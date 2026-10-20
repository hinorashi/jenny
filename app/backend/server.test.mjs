import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

let upstream;
let apiURL;
let apiProcess;
let appURL;
let pokemonRequests = 0;
let speciesRequests = 0;
let serverOutput = "";

before(async () => {
  upstream = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/v2/pokemon/pikachu") {
      pokemonRequests += 1;
      response.end(JSON.stringify({
        id: 25,
        name: "pikachu",
        base_experience: 112,
        types: [{ slot: 1, type: { name: "electric" } }],
        stats: [{ base_stat: 35, stat: { name: "hp" } }],
        sprites: {
          front_default: "https://example.test/sprite.png",
          other: { "official-artwork": { front_default: "https://example.test/art.png" } },
        },
        species: { url: `${apiURL}/api/v2/pokemon-species/25` },
      }));
      return;
    }
    if (request.url === "/api/v2/pokemon-species/25") {
      speciesRequests += 1;
      response.end(JSON.stringify({
        flavor_text_entries: [
          { flavor_text: "An electric mouse.\nIt stores electricity.", language: { name: "en" } },
          { flavor_text: "Une souris.", language: { name: "fr" } },
        ],
      }));
      return;
    }
    response.writeHead(404).end();
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  apiURL = `http://127.0.0.1:${upstream.address().port}`;
  apiProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      PORT: "0",
      LISTEN_ADDRESS: "127.0.0.1",
      POKEAPI_BASE_URL: `${apiURL}/api/v2`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`API did not start within 5 seconds: ${serverOutput}`)), 5000);
    apiProcess.stdout.on("data", (chunk) => {
      serverOutput += chunk.toString();
      const match = serverOutput.match(/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    apiProcess.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
    apiProcess.once("error", reject);
    apiProcess.once("exit", (code) => reject(new Error(`API exited before starting (${code}): ${serverOutput}`)));
  });
  appURL = `http://127.0.0.1:${port}`;
});

after(async () => {
  apiProcess?.kill();
  await new Promise((resolve) => upstream.close(resolve));
});

test("PokéAPI-shaped fixture returns normalized Pokémon data and reuses cache", async () => {
  const firstResponse = await fetch(`${appURL}/api/pokemon/Pikachu`);
  const secondResponse = await fetch(`${appURL}/api/pokemon/pikachu`);
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.deepEqual(await firstResponse.json(), {
    id: 25,
    name: "pikachu",
    baseExperience: 112,
    types: ["electric"],
    stats: [{ name: "hp", value: 35 }],
    imageUrl: "https://example.test/art.png",
    description: "An electric mouse. It stores electricity.",
  });
  assert.equal(pokemonRequests, 1);
  assert.equal(speciesRequests, 1);
});

test("health and invalid input are handled", async () => {
  assert.equal((await fetch(`${appURL}/healthz`)).status, 204);
  assert.equal((await fetch(`${appURL}/api/pokemon/%2Fetc%2Fpasswd`)).status, 400);
});

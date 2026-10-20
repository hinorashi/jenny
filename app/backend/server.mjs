import { createServer } from "node:http";
import { URL } from "node:url";

const listenAddress = process.env.LISTEN_ADDRESS ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 8080);
const apiBaseURL = (process.env.POKEAPI_BASE_URL ?? "https://pokeapi.co/api/v2").replace(/\/+$/, "");
const cacheTTL = 10 * 60 * 1000;
const maxCacheEntries = 512;
const cache = new Map();
const namePattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/healthz") {
    response.writeHead(204).end();
    return;
  }

  if (request.method !== "GET" || !url.pathname.startsWith("/api/pokemon/")) {
    sendJSON(response, 404, { error: "Not found." });
    return;
  }

  let name;
  try {
    name = decodeURIComponent(url.pathname.slice("/api/pokemon/".length)).trim().toLowerCase();
  } catch {
    sendJSON(response, 400, { error: "Enter a Pokémon name or Pokédex number." });
    return;
  }
  if (!namePattern.test(name)) {
    sendJSON(response, 400, { error: "Enter a Pokémon name or Pokédex number." });
    return;
  }

  const cached = cache.get(name);
  if (cached && cached.expiresAt > Date.now()) {
    sendJSON(response, 200, cached.value);
    return;
  }
  cache.delete(name);

  try {
    const pokemon = await fetchPokemon(name);
    cache.set(name, { value: pokemon, expiresAt: Date.now() + cacheTTL });
    if (cache.size > maxCacheEntries) {
      cache.delete(cache.keys().next().value);
    }
    sendJSON(response, 200, pokemon);
  } catch (error) {
    if (error instanceof UpstreamError && error.statusCode === 404) {
      sendJSON(response, 404, { error: "Pokémon not found." });
      return;
    }
    console.error(`PokéAPI request failed for "${name}":`, error);
    sendJSON(response, 502, { error: "PokéAPI is temporarily unavailable. Try again shortly." });
  }
});

server.listen(port, listenAddress, () => {
  console.log(`Pokémon API listening on ${listenAddress}:${server.address().port}`);
});

async function fetchPokemon(name) {
  const source = await fetchJSON(`${apiBaseURL}/pokemon/${encodeURIComponent(name)}`);
  const result = {
    id: source.id,
    name: source.name,
    baseExperience: source.base_experience,
    types: source.types.map(({ type }) => type.name),
    stats: source.stats.map(({ base_stat, stat }) => ({ name: stat.name, value: base_stat })),
    imageUrl: source.sprites.other?.["official-artwork"]?.front_default || source.sprites.front_default || "",
    description: "",
  };

  if (source.species?.url) {
    const speciesURL = validateSpeciesURL(source.species.url);
    const species = await fetchJSON(speciesURL);
    const description = species.flavor_text_entries.find(({ language }) => language.name === "en");
    result.description = description?.flavor_text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
  }
  return result;
}

function validateSpeciesURL(value) {
  const base = new URL(apiBaseURL);
  const speciesURL = new URL(value);
  const pathPrefix = `${base.pathname.replace(/\/+$/, "")}/pokemon-species/`;
  if (
    speciesURL.origin !== base.origin
    || speciesURL.username
    || speciesURL.password
    || !speciesURL.pathname.startsWith(pathPrefix)
  ) {
    throw new Error("Species URL is outside the configured PokéAPI species endpoint.");
  }
  return speciesURL;
}

async function fetchJSON(value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(value, { signal: controller.signal, redirect: "error" });
    if (!response.ok) {
      throw new UpstreamError(response.status);
    }
    const body = await response.text();
    if (body.length > 4 * 1024 * 1024) {
      throw new Error("Upstream response exceeded the size limit.");
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

function sendJSON(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

class UpstreamError extends Error {
  constructor(statusCode) {
    super(`Upstream returned status ${statusCode}`);
    this.statusCode = statusCode;
  }
}

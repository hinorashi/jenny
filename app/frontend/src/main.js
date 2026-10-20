import "./style.css";

document.querySelector("#app").innerHTML = `
  <header>
    <h1>Pokédex</h1>
    <p>A tiny demo powered by PokéAPI</p>
  </header>
  <main>
    <form id="search-form">
      <label for="pokemon-name" class="visually-hidden">Pokémon name or number</label>
      <input id="pokemon-name" name="pokemon" autocomplete="off" placeholder="Try Pikachu or 25" required>
      <button id="search-button" type="submit">Search</button>
    </form>
    <p id="status" role="status" aria-live="polite">Search by Pokémon name or Pokédex number.</p>
    <article id="pokemon-card" class="card" hidden>
      <div class="artwork"><img id="pokemon-image" alt=""></div>
      <div>
        <div class="heading"><h2 id="pokemon-title"></h2><span id="pokemon-number" class="number"></span></div>
        <div id="pokemon-types" class="types"></div>
        <p>Base experience: <strong id="pokemon-experience"></strong></p>
        <p id="pokemon-description" class="description"></p>
        <ul id="pokemon-stats" class="stats"></ul>
      </div>
    </article>
  </main>
`;

const form = document.querySelector("#search-form");
const input = document.querySelector("#pokemon-name");
const button = document.querySelector("#search-button");
const status = document.querySelector("#status");
const card = document.querySelector("#pokemon-card");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;

  button.disabled = true;
  status.className = "";
  status.textContent = "Looking up Pokémon…";
  card.hidden = true;
  try {
    const response = await fetch(`/api/pokemon/${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load Pokémon.");
    renderPokemon(data);
    status.textContent = "";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message || "Request failed. Please try again.";
  } finally {
    button.disabled = false;
  }
});

function renderPokemon(pokemon) {
  document.querySelector("#pokemon-title").textContent = pokemon.name;
  document.querySelector("#pokemon-number").textContent = `#${String(pokemon.id).padStart(3, "0")}`;
  document.querySelector("#pokemon-experience").textContent = pokemon.baseExperience;
  document.querySelector("#pokemon-description").textContent =
    pokemon.description || "No English description available.";

  const image = document.querySelector("#pokemon-image");
  image.src = pokemon.imageUrl || "";
  image.alt = `${pokemon.name} artwork`;
  image.hidden = !pokemon.imageUrl;

  const types = document.querySelector("#pokemon-types");
  types.replaceChildren(...pokemon.types.map((type) => {
    const badge = document.createElement("span");
    badge.className = "type";
    badge.textContent = type;
    return badge;
  }));

  const stats = document.querySelector("#pokemon-stats");
  stats.replaceChildren(...pokemon.stats.map((stat) => {
    const item = document.createElement("li");
    item.textContent = stat.name;
    const value = document.createElement("strong");
    value.textContent = stat.value;
    item.append(value);
    return item;
  }));
  card.hidden = false;
}

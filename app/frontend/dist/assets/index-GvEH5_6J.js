(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})(),document.querySelector(`#app`).innerHTML=`
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
`;var e=document.querySelector(`#search-form`),t=document.querySelector(`#pokemon-name`),n=document.querySelector(`#search-button`),r=document.querySelector(`#status`),i=document.querySelector(`#pokemon-card`);e.addEventListener(`submit`,async e=>{e.preventDefault();let o=t.value.trim();if(o){n.disabled=!0,r.className=``,r.textContent=`Looking up Pokémon…`,i.hidden=!0;try{let e=await fetch(`/api/pokemon/${encodeURIComponent(o)}`),t=await e.json();if(!e.ok)throw Error(t.error||`Could not load Pokémon.`);a(t),r.textContent=``}catch(e){r.className=`error`,r.textContent=e.message||`Request failed. Please try again.`}finally{n.disabled=!1}}});function a(e){document.querySelector(`#pokemon-title`).textContent=e.name,document.querySelector(`#pokemon-number`).textContent=`#${String(e.id).padStart(3,`0`)}`,document.querySelector(`#pokemon-experience`).textContent=e.baseExperience,document.querySelector(`#pokemon-description`).textContent=e.description||`No English description available.`;let t=document.querySelector(`#pokemon-image`);t.src=e.imageUrl||``,t.alt=`${e.name} artwork`,t.hidden=!e.imageUrl,document.querySelector(`#pokemon-types`).replaceChildren(...e.types.map(e=>{let t=document.createElement(`span`);return t.className=`type`,t.textContent=e,t})),document.querySelector(`#pokemon-stats`).replaceChildren(...e.stats.map(e=>{let t=document.createElement(`li`);t.textContent=e.name;let n=document.createElement(`strong`);return n.textContent=e.value,t.append(n),t})),i.hidden=!1}
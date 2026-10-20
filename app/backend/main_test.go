package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHandlePokemonNormalizesAndCachesResponse(t *testing.T) {
	var pokemonRequests, speciesRequests int
	var upstreamURL string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v2/pokemon/pikachu":
			pokemonRequests++
			_, _ = fmt.Fprintf(w, `{
				"id": 25,
				"name": "pikachu",
				"base_experience": 112,
				"types": [{"slot": 1, "type": {"name": "electric"}}],
				"stats": [{"base_stat": 35, "stat": {"name": "hp"}}],
				"sprites": {
					"front_default": "https://example.test/sprite.png",
					"other": {"official-artwork": {"front_default": "https://example.test/art.png"}}
				},
				"species": {"url": "%s/api/v2/pokemon-species/25"}
			}`, upstreamURL)
		case "/api/v2/pokemon-species/25":
			speciesRequests++
			_, _ = w.Write([]byte(`{"flavor_text_entries":[
				{"flavor_text":"An electric mouse.\nIt stores electricity.","language":{"name":"en"}},
				{"flavor_text":"Une souris.","language":{"name":"fr"}}
			]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	upstreamURL = upstream.URL

	server := &apiServer{
		client:  upstream.Client(),
		baseURL: upstream.URL + "/api/v2",
		cache:   &responseCache{entries: make(map[string]cachedPokemon)},
	}
	request := func() *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/pokemon/Pikachu", nil)
		req.SetPathValue("name", "Pikachu")
		server.handlePokemon(recorder, req)
		return recorder
	}

	first := request()
	second := request()
	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("expected 200 responses, got %d and %d", first.Code, second.Code)
	}

	var result pokemon
	if err := json.Unmarshal(first.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result.ID != 25 || result.Name != "pikachu" || result.ImageURL != "https://example.test/art.png" {
		t.Fatalf("unexpected Pokémon response: %+v", result)
	}
	if result.Description != "An electric mouse. It stores electricity." {
		t.Fatalf("unexpected description: %q", result.Description)
	}
	if pokemonRequests != 1 || speciesRequests != 1 {
		t.Fatalf("expected one request per upstream endpoint, got pokemon=%d species=%d", pokemonRequests, speciesRequests)
	}
}

func TestHandlePokemonRejectsInvalidName(t *testing.T) {
	server := &apiServer{cache: &responseCache{entries: make(map[string]cachedPokemon)}}
	request := httptest.NewRequest(http.MethodGet, "/api/pokemon/../../etc/passwd", nil)
	request.SetPathValue("name", "../../etc/passwd")
	recorder := httptest.NewRecorder()

	server.handlePokemon(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestResponseCacheExpiresEntries(t *testing.T) {
	cache := &responseCache{entries: make(map[string]cachedPokemon)}
	now := time.Now()
	cache.put("pikachu", pokemon{Name: "pikachu"}, now)

	if _, ok := cache.get("pikachu", now.Add(cacheTTL)); ok {
		t.Fatal("expected entry to expire at its expiration time")
	}
}

func TestCleanDescription(t *testing.T) {
	got := cleanDescription("A line.\nAnother\fline.")
	if got != "A line. Another line." {
		t.Fatalf("unexpected description: %q", got)
	}
}

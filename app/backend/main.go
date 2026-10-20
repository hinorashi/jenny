package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	defaultListenAddress = ":8080"
	defaultAPIBaseURL    = "https://pokeapi.co/api/v2"
	cacheTTL             = 10 * time.Minute
	maxCacheEntries      = 512
)

var pokemonNamePattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`)

type pokemon struct {
	ID             int      `json:"id"`
	Name           string   `json:"name"`
	BaseExperience int      `json:"baseExperience"`
	Types          []string `json:"types"`
	Stats          []stat   `json:"stats"`
	ImageURL       string   `json:"imageUrl"`
	Description    string   `json:"description"`
}

type stat struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}

type cachedPokemon struct {
	value     pokemon
	expiresAt time.Time
}

type responseCache struct {
	mu      sync.Mutex
	entries map[string]cachedPokemon
}

type apiServer struct {
	client  *http.Client
	baseURL string
	cache   *responseCache
}

type pokemonResponse struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	BaseExperience int    `json:"base_experience"`
	Types          []struct {
		Slot int `json:"slot"`
		Type struct {
			Name string `json:"name"`
		} `json:"type"`
	} `json:"types"`
	Stats []struct {
		BaseStat int `json:"base_stat"`
		Stat     struct {
			Name string `json:"name"`
		} `json:"stat"`
	} `json:"stats"`
	Sprites struct {
		FrontDefault string `json:"front_default"`
		Other        struct {
			OfficialArtwork struct {
				FrontDefault string `json:"front_default"`
			} `json:"official-artwork"`
		} `json:"other"`
	} `json:"sprites"`
	Species struct {
		URL string `json:"url"`
	} `json:"species"`
}

type speciesResponse struct {
	FlavorTextEntries []struct {
		FlavorText string `json:"flavor_text"`
		Language   struct {
			Name string `json:"name"`
		} `json:"language"`
	} `json:"flavor_text_entries"`
}

func main() {
	listenAddress := strings.TrimSpace(getenv("LISTEN_ADDRESS", defaultListenAddress))
	apiBaseURL := strings.TrimRight(strings.TrimSpace(getenv("POKEAPI_BASE_URL", defaultAPIBaseURL)), "/")
	server := &apiServer{
		client: &http.Client{
			Timeout: 6 * time.Second,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		baseURL: apiBaseURL,
		cache:   &responseCache{entries: make(map[string]cachedPokemon)},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/pokemon/{name}", server.handlePokemon)

	log.Printf("Pokémon API listening on %s", listenAddress)
	if err := http.ListenAndServe(listenAddress, mux); err != nil {
		log.Fatal(err)
	}
}

func (s *apiServer) handlePokemon(w http.ResponseWriter, r *http.Request) {
	name := strings.ToLower(strings.TrimSpace(r.PathValue("name")))
	if !pokemonNamePattern.MatchString(name) {
		writeError(w, http.StatusBadRequest, "Enter a Pokémon name or Pokédex number.")
		return
	}

	if value, ok := s.cache.get(name, time.Now()); ok {
		writeJSON(w, http.StatusOK, value)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	value, err := s.fetchPokemon(ctx, name)
	if err != nil {
		var upstreamError *upstreamError
		if errors.As(err, &upstreamError) && upstreamError.statusCode == http.StatusNotFound {
			writeError(w, http.StatusNotFound, "Pokémon not found.")
			return
		}
		log.Printf("PokéAPI request failed for %q: %v", name, err)
		writeError(w, http.StatusBadGateway, "PokéAPI is temporarily unavailable. Try again shortly.")
		return
	}

	s.cache.put(name, value, time.Now())
	writeJSON(w, http.StatusOK, value)
}

func (s *apiServer) fetchPokemon(ctx context.Context, name string) (pokemon, error) {
	var source pokemonResponse
	if err := s.getJSON(ctx, s.baseURL+"/pokemon/"+name, &source); err != nil {
		return pokemon{}, err
	}

	result := pokemon{
		ID:             source.ID,
		Name:           source.Name,
		BaseExperience: source.BaseExperience,
		Types:          make([]string, 0, len(source.Types)),
		Stats:          make([]stat, 0, len(source.Stats)),
		ImageURL:       source.Sprites.Other.OfficialArtwork.FrontDefault,
	}
	if result.ImageURL == "" {
		result.ImageURL = source.Sprites.FrontDefault
	}
	for _, item := range source.Types {
		result.Types = append(result.Types, item.Type.Name)
	}
	for _, item := range source.Stats {
		result.Stats = append(result.Stats, stat{Name: item.Stat.Name, Value: item.BaseStat})
	}

	if source.Species.URL != "" {
		speciesURL, err := s.validateSpeciesURL(source.Species.URL)
		if err != nil {
			return pokemon{}, err
		}
		var species speciesResponse
		if err := s.getJSON(ctx, speciesURL, &species); err != nil {
			return pokemon{}, err
		}
		for _, item := range species.FlavorTextEntries {
			if item.Language.Name == "en" {
				result.Description = cleanDescription(item.FlavorText)
				break
			}
		}
	}

	return result, nil
}

func (s *apiServer) validateSpeciesURL(value string) (string, error) {
	base, err := url.Parse(s.baseURL)
	if err != nil {
		return "", fmt.Errorf("parse PokéAPI base URL: %w", err)
	}
	speciesURL, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("parse species URL: %w", err)
	}
	if speciesURL.Scheme != base.Scheme || speciesURL.Host != base.Host || speciesURL.User != nil {
		return "", fmt.Errorf("species URL is outside the configured PokéAPI origin")
	}
	speciesPathPrefix := strings.TrimRight(base.EscapedPath(), "/") + "/pokemon-species/"
	if !strings.HasPrefix(speciesURL.EscapedPath(), speciesPathPrefix) {
		return "", fmt.Errorf("species URL is outside the PokéAPI species endpoint")
	}
	return speciesURL.String(), nil
}

func (s *apiServer) getJSON(ctx context.Context, url string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("create upstream request: %w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("request upstream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return &upstreamError{statusCode: resp.StatusCode}
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(target); err != nil {
		return fmt.Errorf("decode upstream response: %w", err)
	}
	return nil
}

type upstreamError struct {
	statusCode int
}

func (e *upstreamError) Error() string {
	return fmt.Sprintf("upstream returned status %d", e.statusCode)
}

func (c *responseCache) get(key string, now time.Time) (pokemon, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, ok := c.entries[key]
	if !ok {
		return pokemon{}, false
	}
	if !now.Before(entry.expiresAt) {
		delete(c.entries, key)
		return pokemon{}, false
	}
	return entry.value, true
}

func (c *responseCache) put(key string, value pokemon, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for existingKey, entry := range c.entries {
		if !now.Before(entry.expiresAt) {
			delete(c.entries, existingKey)
		}
	}
	if _, exists := c.entries[key]; !exists && len(c.entries) >= maxCacheEntries {
		for existingKey := range c.entries {
			delete(c.entries, existingKey)
			break
		}
	}
	c.entries[key] = cachedPokemon{value: value, expiresAt: now.Add(cacheTTL)}
}

func cleanDescription(value string) string {
	return strings.Join(strings.Fields(strings.NewReplacer("\n", " ", "\f", " ").Replace(value)), " ")
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		log.Printf("write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://backend:8080",
      "/healthz": "http://backend:8080",
    },
  },
});

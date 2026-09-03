import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "localhost",
    port: 3000,
    proxy: {
      "/api": {
        target: "https://danjion-api-dev.muphobia2.workers.dev",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
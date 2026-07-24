import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: Number(process.env.PORT || process.env.VITE_PORT || 5174),
    strictPort: false,
    // Browser → Vite → local Buzz relay (avoids mixed-content / CORS pain)
    proxy: {
      "/relay-ws": {
        target: process.env.BUZZ_RELAY_HTTP || "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/relay-ws/, ""),
      },
      "/relay-http": {
        target: process.env.BUZZ_RELAY_HTTP || "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/relay-http/, ""),
      },
    },
  },
});

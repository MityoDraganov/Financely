import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  build: {
    sourcemap: true,
  },
  // Use a user-scoped temp cache to avoid stale/shared or locked global caches.
  cacheDir: path.resolve(process.env.TMPDIR ?? "/tmp", "financely-vite-cache"),
})

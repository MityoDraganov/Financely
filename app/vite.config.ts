import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
  },
  // Use a user-scoped temp cache to avoid stale/shared or locked global caches.
  cacheDir: path.resolve(process.env.TMPDIR ?? "/tmp", "financely-vite-cache"),
})

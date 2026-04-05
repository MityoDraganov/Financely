import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminSrcRoot = path.resolve(__dirname, "./src");
const appSrcRoot = path.resolve(__dirname, "../app/src");

const resolvePathFromRoot = (root: string, subPath: string): string | null => {
  const candidates = [
    `${subPath}.ts`,
    `${subPath}.tsx`,
    `${subPath}.js`,
    `${subPath}.jsx`,
    `${subPath}.mjs`,
    `${subPath}.cjs`,
    `${subPath}.json`,
    path.join(subPath, "index.ts"),
    path.join(subPath, "index.tsx"),
    path.join(subPath, "index.js"),
    path.join(subPath, "index.jsx"),
  ];

  for (const candidate of candidates) {
    const absoluteCandidate = path.resolve(root, candidate);
    if (fs.existsSync(absoluteCandidate)) {
      return absoluteCandidate;
    }
  }
  return null;
};

const normalizeImporterPath = (importer?: string): string | null => {
  if (!importer) return null;
  const [withoutQuery] = importer.split("?");
  if (withoutQuery.startsWith("/@fs/")) {
    return withoutQuery.slice("/@fs".length);
  }
  return withoutQuery;
};

const adminAppAliasResolver = {
  name: "admin-app-alias-resolver",
  enforce: "pre" as const,
  resolveId(source: string, importer?: string) {
    if (!source.startsWith("@/")) {
      return null;
    }
    const subPath = source.slice(2);
    const normalizedImporter = normalizeImporterPath(importer);
    const appSrcMarker = `${path.sep}app${path.sep}src${path.sep}`;
    const importerIsAppFile = Boolean(
      normalizedImporter &&
        (
          normalizedImporter.startsWith(appSrcRoot + path.sep) ||
          normalizedImporter.includes(appSrcMarker) ||
          normalizedImporter.startsWith("../app/src/") ||
          normalizedImporter.includes("/../app/src/")
        ),
    );
    const primaryRoot = importerIsAppFile ? appSrcRoot : adminSrcRoot;
    const secondaryRoot = importerIsAppFile ? adminSrcRoot : appSrcRoot;
    const primaryResolved = resolvePathFromRoot(primaryRoot, subPath);
    if (primaryResolved) {
      return primaryResolved;
    }
    if (importerIsAppFile) {
      return null;
    }
    return resolvePathFromRoot(secondaryRoot, subPath);
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [adminAppAliasResolver, react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-runtime.js",
      ),
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "./node_modules/react/jsx-dev-runtime.js",
      ),
      "@app": appSrcRoot,
      "@shared": path.resolve(__dirname, "../app/src/shared"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    strictPort: true,
  },
  preview: {
    port: 3001,
    strictPort: true,
  },
})

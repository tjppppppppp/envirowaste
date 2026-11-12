import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Tailwind, lightningcss and the `@` alias, as the build every publish runs sets them, so the preview's styles are the
// published ones.
export default defineConfig({
  css: { transformer: "lightningcss" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    tailwindcss(),
    tanstackStart({ router: { generatedRouteTree: "./route-tree.gen.ts" } }),
    react(),
  ],
});

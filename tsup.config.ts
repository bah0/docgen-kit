import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/core/index.ts",
    server: "src/server/index.ts",
    client: "src/client/index.ts",
    // The "use client" directive at the top of src/react/index.ts is preserved in the bundle.
    react: "src/react/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  target: "es2022",
  clean: true,
  // Shared code (core) lives in chunks, so every entry point reuses the same modules.
  splitting: true,
  external: ["react", "lexical", "pdf-lib", "handlebars", /^@lexical\//],
  onSuccess: async () => {
    copyFileSync("src/styles/document.css", "dist/document.css");
  },
});

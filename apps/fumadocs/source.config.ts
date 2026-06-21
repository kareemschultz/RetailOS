import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    // Use shiki's JS regex engine instead of the WASM oniguruma engine. Rolldown's
    // `builtin:vite-wasm-fallback` (Vite 8 / TanStack Start) can't bundle shiki's
    // onig.wasm, which breaks `vite build`. The JS engine avoids the WASM path.
    rehypeCodeOptions: { engine: "js" },
  },
});

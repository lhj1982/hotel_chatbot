import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [preact(), cssInjectedByJs()],
  build: {
    lib: {
      entry: "src/widget.tsx",
      name: "HotelChatWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    minify: "esbuild",
  },
});

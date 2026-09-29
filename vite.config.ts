import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// pdf.js needs its character maps (non-Latin text), standard fonts, image decoders (JPEG 2000)
// and colour profiles served next to the app, under /pdfjs/. They're fetched only when a PDF needs them.
const PDFJS_ASSETS = ["cmaps", "standard_fonts", "wasm", "iccs"];

// No fixed port: Vite starts at 5173 and moves to the next free one if that's taken.
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: PDFJS_ASSETS.map(dir => ({ src: `node_modules/pdfjs-dist/${dir}`, dest: "pdfjs", rename: { stripBase: 2 } })),
    }),
  ],
});

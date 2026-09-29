import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// No fixed port: Vite starts at 5173 and moves to the next free one if that's taken.
export default defineConfig({
  plugins: [react()],
});

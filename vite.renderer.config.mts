import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});

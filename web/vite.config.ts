import { defineConfig } from "vite";
import { resolve } from "node:path";

// Relative base so the built app works when opened from Electron via file://
// and when hosted at a sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        popout: resolve(__dirname, "popout.html"),
      },
    },
  },
});

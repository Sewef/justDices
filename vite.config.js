import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: '/',
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        quickdice: resolve(__dirname, "quickdice.html")
      }
    }
  }
});

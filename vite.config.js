import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  // Relative base: works under any GitHub Pages subpath (e.g. /fiiocontrol-oss/)
  // and at the root for Cloudflare.
  base: "./",
  plugins: [solid()],
});

import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [foldkit()],
  optimizeDeps: { entries: ["src/entry.ts"] },
});

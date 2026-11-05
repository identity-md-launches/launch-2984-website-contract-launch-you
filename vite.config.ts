import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "deployment-handoff",
      async generateBundle() {
        try {
          const source = await readFile(".imd/reads/deployment.json", "utf8");
          JSON.parse(source);
          this.emitFile({
            type: "asset",
            fileName: "imd-deployment.json",
            source,
          });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      },
    },
  ],
  base: "./",
  build: { target: "es2022", sourcemap: false },
});

import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    fresh({
      serverEntry: "./src/main.ts",
      clientEntry: "./src/client.ts",
      routeDir: "./src/routes",
      islandsDir: "./src/islands",
    }),
    tailwindcss(),
  ],
});

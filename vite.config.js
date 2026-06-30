import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages at https://<user>.github.io/<repo>/ set base to "/<repo>/".
// The deploy workflow passes VITE_BASE; locally it defaults to "/".
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return { base: env.VITE_BASE || "/", plugins: [react()] };
});

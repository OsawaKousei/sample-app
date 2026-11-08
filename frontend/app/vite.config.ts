import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // .envはバックエンド専用。Viteには読み込ませません。
  envDir: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:3000",
      "/healthz": process.env.API_PROXY_TARGET || "http://127.0.0.1:3000",
    },
  },
});

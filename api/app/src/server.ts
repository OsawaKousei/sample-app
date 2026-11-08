import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { openStore } from "./database.ts";
import { createApp } from "./app.ts";
import { createAiService } from "./ai.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const envPath = resolve(root, ".env");
if (existsSync(envPath)) loadEnvFile(envPath);
const store = openStore(
  resolve(root, process.env.DATABASE_PATH || ".local/idea-board.sqlite"),
);
const app = createApp({
  store,
  ai: createAiService({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  }),
});
app.all("/api/*", (c) => c.json({ error: "APIが見つかりません。" }, 404));
const frontendPath = resolve(root, "frontend/app/dist");
if (existsSync(frontendPath)) app.use("*", serveStatic({ root: frontendPath }));
const port = Number(process.env.PORT || 3000);
const hostname = "127.0.0.1";
const server = serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`API: http://${hostname}:${port}`);
});
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

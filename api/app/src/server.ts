import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { config } from "dotenv";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { openStore } from "./database.ts";
import { createApp } from "./app.ts";
import { createAiService } from "./ai.ts";
import type { AiMode } from "../../../shared/board.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
config({ path: resolve(root, ".env"), quiet: true });

function positiveInt(name: string, fallback: number, max: number) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(`${name} は1〜${max}の整数にしてください。`);
  return value;
}

const mode = process.env.AI_MODE || "mock";
if (!["mock", "openai", "disabled"].includes(mode))
  throw new Error("AI_MODE は mock / openai / disabled のいずれかです。");
const store = openStore(
  resolve(root, process.env.DATABASE_PATH || ".local/idea-board.sqlite"),
);
const app = createApp({
  store,
  ai: createAiService({
    mode: mode as AiMode,
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    maxOutputTokens: positiveInt("AI_MAX_OUTPUT_TOKENS", 800, 2000),
  }),
  dailyLimit: positiveInt("AI_DAILY_LIMIT", 20, 1000),
});

// npm run build 後は npm start で画面もAPIも3000番から配信します。
app.all("/api/*", (c) => c.json({ error: "APIが見つかりません。" }, 404));
app.use("*", serveStatic({ root: resolve(root, "frontend/app/dist") }));

const port = positiveInt("PORT", 3000, 65535);
const server = serve(
  { fetch: app.fetch, port, hostname: process.env.HOST || "127.0.0.1" },
  () => {
    console.log(`API: http://127.0.0.1:${port} / AI: ${mode}`);
  },
);
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

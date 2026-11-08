import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "./database.ts";
import { createApp } from "./app.ts";
import { createAiService } from "./ai.ts";
import type { AiService } from "./ai.ts";
import type { Card, CardInput } from "../../../shared/board.ts";

const input: CardInput = {
  title: "週末の散歩",
  description: "近所の公園で本を読む",
  category: "暮らし",
  status: "アイデア",
};
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function fixture(t: TestContext, ai?: AiService) {
  const store = openStore(":memory:", false);
  t.after(() => store.close());
  const service =
    ai ||
    createAiService({ mode: "mock", model: "unused", maxOutputTokens: 800 });
  return { store, app: createApp({ store, ai: service, dailyLimit: 2 }) };
}

test("CRUD・日本語検索・カテゴリとステータスの複合フィルタ", async (t) => {
  const { app } = fixture(t);
  const created = await app.request("/api/cards", json("POST", input));
  assert.equal(created.status, 201);
  const { card } = (await created.json()) as { card: Card };
  assert.equal(card.title, input.title);
  assert.ok(card.id);
  assert.equal((await app.request(`/api/cards/${card.id}`)).status, 200);
  const updated = await app.request(
    `/api/cards/${card.id}`,
    json("PUT", { ...input, status: "進行中" }),
  );
  assert.equal((await updated.json()).card.status, "進行中");
  const matches = await app.request(
    `/api/cards?q=${encodeURIComponent("公園")}&category=${encodeURIComponent("暮らし")}&status=${encodeURIComponent("進行中")}`,
  );
  assert.equal((await matches.json()).cards.length, 1);
  assert.equal(
    (await (await app.request("/api/cards?q=nonexistent")).json()).cards.length,
    0,
  );
  assert.equal(
    (await app.request(`/api/cards/${card.id}`, { method: "DELETE" })).status,
    204,
  );
  for (const method of ["GET", "PUT", "DELETE", "POST"]) {
    const path =
      method === "POST"
        ? `/api/cards/${card.id}/analyze`
        : `/api/cards/${card.id}`;
    assert.equal(
      (
        await app.request(
          path,
          method === "PUT" ? json("PUT", input) : { method },
        )
      ).status,
      404,
    );
  }
});

test("空白・型・長さ・列挙値・壊れたJSONを拒否する", async (t) => {
  const { app } = fixture(t);
  const invalid = [
    null,
    [],
    {},
    { ...input, title: "  " },
    { ...input, title: 2 },
    { ...input, title: "a".repeat(121) },
    { ...input, description: null },
    { ...input, description: "a".repeat(4001) },
    { ...input, category: "不正" },
    { ...input, status: "不正" },
  ];
  for (const body of invalid)
    assert.equal(
      (await app.request("/api/cards", json("POST", body))).status,
      400,
    );
  assert.equal(
    (await app.request("/api/cards", { method: "POST", body: "{bad json" }))
      .status,
    400,
  );
  const res = await app.request(
    "/api/cards",
    json("POST", { ...input, title: "  test  " }),
  );
  assert.equal((await res.json()).card.title, "test");
});

test("SQLiteの永続化・初回データ・全件削除後に再投入しない", () => {
  const directory = mkdtempSync(join(tmpdir(), "idea-board-test-"));
  const path = join(directory, "nested", "board.sqlite");
  let store = openStore(path);
  try {
    assert.equal(store.list().length, 6);
    store.list().forEach((card) => store.remove(card.id));
    const card = store.create(input);
    store.saveAnalysis(card, "保存した結果", "mock");
    store.close();
    store = openStore(path);
    assert.equal(store.list().length, 1);
    assert.equal(store.get(card.id)?.analysis, "保存した結果");
    store.remove(card.id);
    store.close();
    store = openStore(path);
    assert.equal(store.list().length, 0);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("モック分析を保存し、本文変更時は古い分析を無効にする", async (t) => {
  const { app, store } = fixture(t);
  const card = store.create(input);
  const response = await app.request(`/api/cards/${card.id}/analyze`, {
    method: "POST",
  });
  assert.equal(response.status, 200);
  const saved = (await response.json()).card as Card;
  assert.match(saved.analysis!, /サンプル応答/);
  assert.equal(saved.analysisMode, "mock");
  assert.ok(saved.analyzedAt);
  const classified = store.update(card.id, { ...input, status: "完了" });
  assert.equal(classified.analysis, saved.analysis);
  const edited = store.update(card.id, { ...input, description: "新しい説明" });
  assert.equal(edited.analysis, null);
  assert.equal(edited.analyzedAt, null);
});

test("AI未設定・無効でもCRUDは利用できる", async (t) => {
  for (const mode of ["openai", "disabled"] as const) {
    const ai = createAiService({ mode, model: "test", maxOutputTokens: 800 });
    const { app, store } = fixture(t, ai);
    const card = store.create(input);
    assert.equal(
      (await app.request(`/api/cards/${card.id}/analyze`, { method: "POST" }))
        .status,
      503,
    );
    assert.equal(
      (await app.request("/api/cards", json("POST", input))).status,
      201,
    );
    const config = await (await app.request("/api/config")).json();
    assert.equal(config.aiAvailable, false);
    assert.equal(config.apiKey, undefined);
  }
});

test("AI失敗時もCRUDと既存分析を保持し、失敗を含む日次上限を適用", async (t) => {
  let calls = 0;
  const { app, store } = fixture(t, {
    mode: "openai",
    available: true,
    analyze: async () => {
      calls++;
      throw new Error("secret-key");
    },
  });
  const card = store.create(input);
  store.saveAnalysis(card, "以前の結果", "openai");
  for (let i = 0; i < 2; i++) {
    const response = await app.request(`/api/cards/${card.id}/analyze`, {
      method: "POST",
    });
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /secret-key/);
  }
  assert.equal(
    (await app.request(`/api/cards/${card.id}/analyze`, { method: "POST" }))
      .status,
    429,
  );
  assert.equal(calls, 2);
  assert.equal(store.get(card.id)?.analysis, "以前の結果");
  assert.equal(
    (await app.request("/api/cards", json("POST", input))).status,
    201,
  );
});

test("日次上限はSQLiteの再オープン後も残り、UTCの翌日は新しい枠になる", () => {
  const directory = mkdtempSync(join(tmpdir(), "idea-budget-test-"));
  const path = join(directory, "board.sqlite");
  let store = openStore(path, false);
  try {
    assert.equal(store.reserveAiAttempt(1, "2026-11-08"), true);
    store.close();
    store = openStore(path, false);
    assert.equal(store.reserveAiAttempt(1, "2026-11-08"), false);
    assert.equal(store.reserveAiAttempt(1, "2026-11-09"), true);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("二重分析を拒否し、分析待ちの間に編集された結果を保存しない", async (t) => {
  const started = Promise.withResolvers<void>();
  const generated = Promise.withResolvers<string>();
  const { app, store } = fixture(t, {
    mode: "mock",
    available: true,
    analyze: async () => {
      started.resolve();
      return generated.promise;
    },
  });
  const card = store.create(input);
  const first = app.request(`/api/cards/${card.id}/analyze`, {
    method: "POST",
  });
  await started.promise;
  assert.equal(
    (await app.request(`/api/cards/${card.id}/analyze`, { method: "POST" }))
      .status,
    409,
  );
  store.update(card.id, { ...input, title: "変更されたカード" });
  generated.resolve("古い内容の結果");
  assert.equal((await first).status, 409);
  assert.equal(store.get(card.id)?.analysis, null);
});

test("巨大な入力と別Originからの更新を拒否し、未知のAPIはJSON 404", async (t) => {
  const { app } = fixture(t);
  assert.equal(
    (
      await app.request(
        "/api/cards",
        json("POST", { ...input, description: "a".repeat(40000) }),
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await app.request("/api/cards", {
        ...json("POST", input),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await app.request("/api/cards", {
        ...json("POST", input),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
      })
    ).status,
    201,
  );
  assert.equal((await app.request("/api/unknown")).status, 404);
});

test("Responses APIの送信内容とoutput_text取得をSDK経由で検証（通信なし）", async (t) => {
  const { store } = fixture(t);
  const card = store.create(input);
  let calls = 0;
  const service = createAiService({
    mode: "openai",
    apiKey: "test-key-not-real",
    model: "workshop-model",
    maxOutputTokens: 700,
    fetch: async (url, init) => {
      calls++;
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(init!.body as string);
      assert.equal(body.model, "workshop-model");
      assert.equal(body.store, false);
      assert.equal(body.max_output_tokens, 700);
      assert.equal(JSON.parse(body.input).title, input.title);
      assert.match(body.instructions, /最初の一歩/);
      return new Response(
        JSON.stringify({
          id: "resp_test",
          object: "response",
          status: "completed",
          output: [
            {
              type: "message",
              role: "assistant",
              content: [
                {
                  type: "output_text",
                  text: "アイデアの提案",
                  annotations: [],
                },
              ],
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  });
  assert.equal(await service.analyze(card), "アイデアの提案");
  assert.equal(calls, 1);
});

test("OpenAIの失敗を自動再試行せず、未完了応答も保存しない", async (t) => {
  const { store } = fixture(t);
  let calls = 0;
  const service = createAiService({
    mode: "openai",
    apiKey: "test-key",
    model: "test",
    maxOutputTokens: 800,
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          error: { message: "quota", type: "rate_limit_error" },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  await assert.rejects(service.analyze(store.create(input)));
  assert.equal(calls, 1);
  const incomplete = createAiService({
    mode: "openai",
    apiKey: "test-key",
    model: "test",
    maxOutputTokens: 800,
    fetch: async () =>
      new Response(
        JSON.stringify({
          object: "response",
          status: "incomplete",
          output: [],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  });
  await assert.rejects(incomplete.analyze(store.create(input)), /incomplete/);
});

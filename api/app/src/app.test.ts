import { test } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "./database.ts";
import { createApp } from "./app.ts";
import { createAiService } from "./ai.ts";
import type { AiService } from "./ai.ts";
import type { TodoDraft, TodoInput } from "../../../shared/board.ts";

const input: TodoInput = {
  title: "本を読む",
  description: "気になる本を1冊選ぶ",
  theme: "学習",
  priority: "high",
  status: "todo",
};
const drafts: TodoDraft[] = [
  {
    title: "材料を調べる",
    description: "レシピを見て材料をメモする",
    theme: "自炊を始める",
    priority: "high",
  },
  {
    title: "料理する",
    description: "簡単な料理を作ってみる",
    theme: "自炊を始める",
    priority: "medium",
  },
];
function json(body: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
function fixture(t: TestContext, ai = createAiService({ model: "test" })) {
  const store = openStore(":memory:");
  t.after(() => store.close());
  return { store, app: createApp({ store, ai }) };
}
function temporaryDatabase(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "todo-planner-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "planner.sqlite");
}
// SDKへの応答だけを偽装します。外部へ通信しません。
function aiResponse(text: string, status = "completed") {
  return new Response(
    JSON.stringify({
      id: "resp_test",
      object: "response",
      status,
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text, annotations: [] }],
        },
      ],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

test("TODOの登録・一覧・編集・ステータス変更・削除ができる", async (t) => {
  const { app } = fixture(t);
  assert.deepEqual(await (await app.request("/api/todos")).json(), {
    todos: [],
  });
  const response = await app.request(
    "/api/todos",
    json({ ...input, title: "  本を読む  " }),
  );
  assert.equal(response.status, 201);
  const { todo } = await response.json();
  assert.equal(todo.title, "本を読む");
  assert.ok(todo.id);
  assert.ok(todo.createdAt);
  const path = `/api/todos/${todo.id}`;
  for (const status of ["doing", "done"]) {
    const updated = await app.request(
      path,
      json({ ...input, title: "O'Reillyの本を読む", status }, "PUT"),
    );
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).todo.status, status);
  }
  await app.request("/api/todos", json({ ...input, title: "次のTODO" }));
  const { todos } = await (await app.request("/api/todos")).json();
  assert.equal(todos.length, 2);
  assert.equal(todos[0].title, "次のTODO");
  assert.equal(todos[1].title, "O'Reillyの本を読む");
  assert.equal((await app.request(path, { method: "DELETE" })).status, 204);
  assert.equal(
    (await (await app.request("/api/todos")).json()).todos.length,
    1,
  );
  assert.equal((await app.request(path, json(input, "PUT"))).status, 404);
  assert.equal((await app.request(path, { method: "DELETE" })).status, 404);
  assert.equal((await app.request("/api/unknown")).status, 404);
  assert.deepEqual(await (await app.request("/healthz")).json(), {
    status: "ok",
  });
});

test("必須項目と選択肢、不正JSONを確認し、未入力の説明は許可する", async (t) => {
  const { app, store } = fixture(t);
  for (const body of [
    null,
    {},
    { ...input, title: "  " },
    { ...input, title: 123 },
    { ...input, theme: "" },
    { ...input, priority: "urgent" },
    { ...input, status: "unknown" },
    { ...input, description: null },
  ]) {
    assert.equal((await app.request("/api/todos", json(body))).status, 400);
  }
  assert.equal(
    (await app.request("/api/todos", { method: "POST", body: "{bad" })).status,
    400,
  );
  assert.equal(store.list().length, 0);
  assert.equal(
    (await app.request("/api/todos", json({ ...input, description: "" })))
      .status,
    201,
  );
});

test("サンプルでTODOを生成・保存し、通常のTODOと同じように編集できる", async (t) => {
  const { app, store } = fixture(t);
  const response = await app.request(
    "/api/todos/generate",
    json({ goal: "自炊を始めたい" }),
  );
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.mode, "mock");
  assert.equal(result.todos.length, 3);
  assert.ok(result.todos.every((todo: TodoInput) => todo.status === "todo"));
  assert.deepEqual(
    [...new Set(result.todos.map((todo: TodoInput) => todo.theme))],
    ["自炊を始めたい"],
  );
  assert.equal(store.list().length, 3);
  const todo = result.todos[0];
  const updated = await app.request(
    `/api/todos/${todo.id}`,
    json({ ...todo, status: "done" }, "PUT"),
  );
  assert.equal((await updated.json()).todo.status, "done");
});

test("偽のAI応答を未着手TODOとしてまとめて保存する", async (t) => {
  const { app, store } = fixture(t, {
    mode: "openai",
    generate: async (goal) => {
      assert.equal(goal, "料理したい");
      return drafts;
    },
  });
  const response = await app.request(
    "/api/todos/generate",
    json({ goal: " 料理したい " }),
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).mode, "openai");
  assert.deepEqual(
    store.list().map(({ id, createdAt, ...todo }) => todo),
    [...drafts].reverse().map((draft) => ({ ...draft, status: "todo" })),
  );
});

test("AI入力の不備や失敗でTODOを追加せず、内部エラーを漏らさない", async (t) => {
  let calls = 0;
  const ai: AiService = {
    mode: "openai",
    generate: async () => {
      calls++;
      throw new Error("secret-test-key");
    },
  };
  const { app, store } = fixture(t, ai);
  store.create(input);
  for (const body of [null, {}, { goal: " " }, { goal: 123 }]) {
    assert.equal(
      (await app.request("/api/todos/generate", json(body))).status,
      400,
    );
  }
  assert.equal(calls, 0);
  const response = await app.request(
    "/api/todos/generate",
    json({ goal: "料理したい" }),
  );
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret-test-key/);
  assert.equal(calls, 1);
  assert.equal(store.list().length, 1);
});

test("残高不足・利用枠不足・認証エラーを区別し、内部情報を返さない", async (t) => {
  const cases = [
    {
      status: 429,
      code: "credit_balance_exhausted",
      expected: /クレジット残高/,
    },
    { status: 429, code: "insufficient_quota", expected: /利用枠/ },
    { status: 401, code: "invalid_api_key", expected: /キーの認証/ },
    {
      status: 429,
      code: "rate_limit_exceeded",
      expected: /AIでTODOを生成できませんでした/,
    },
  ];
  for (const item of cases) {
    let calls = 0;
    const ai = createAiService({
      apiKey: "secret-test-key",
      model: "test",
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            error: { code: item.code, message: "secret-test-key" },
          }),
          {
            status: item.status,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    });
    const { app, store } = fixture(t, ai);
    const response = await app.request(
      "/api/todos/generate",
      json({ goal: "学習したい" }),
    );
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, item.expected);
    assert.doesNotMatch(body.error, /secret-test-key/);
    assert.equal(store.list().length, 0);
    assert.equal(calls, 1);
  }
});

test("文字数・生成件数・利用回数にアプリ独自の上限を設けない", async (t) => {
  const { app, store } = fixture(t, {
    mode: "openai",
    generate: async () => Array.from({ length: 30 }, () => drafts[0]),
  });
  const title = "あ".repeat(40000);
  assert.equal(
    (await app.request("/api/todos", json({ ...input, title }))).status,
    201,
  );
  assert.equal(store.list()[0].title, title);
  for (let i = 0; i < 3; i++) {
    assert.equal(
      (await app.request("/api/todos/generate", json({ goal: title }))).status,
      201,
    );
  }
  assert.equal(store.list().length, 91);
});

test("再起動後もTODOの編集と削除が保持される", (t) => {
  const path = temporaryDatabase(t);
  let store = openStore(path);
  try {
    const first = store.create(input);
    const second = store.create(input);
    store.update(first.id, { ...input, title: "編集したTODO", status: "done" });
    store.remove(second.id);
    store.close();
    store = openStore(path);
    assert.equal(store.list().length, 1);
    assert.equal(store.get(first.id)?.title, "編集したTODO");
    assert.equal(store.get(first.id)?.status, "done");
  } finally {
    store.close();
  }
});

test("既存のideas・cardsテーブルとデータを保持してTODOを追加する", (t) => {
  const path = temporaryDatabase(t);
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE ideas (id TEXT PRIMARY KEY, idea TEXT, suggestion TEXT);
    INSERT INTO ideas VALUES ('idea-1', '以前の相談', '以前の提案');
    CREATE TABLE cards (id TEXT PRIMARY KEY, title TEXT, description TEXT);
    INSERT INTO cards VALUES ('card-1', '以前のカード', '以前の説明');`);
  old.close();
  for (let i = 0; i < 2; i++) {
    const store = openStore(path);
    try {
      if (i === 0) store.create(input);
      assert.equal(store.list().length, 1);
    } finally {
      store.close();
    }
  }
  const db = new DatabaseSync(path);
  try {
    assert.equal(
      db.prepare("SELECT suggestion FROM ideas").get()!.suggestion,
      "以前の提案",
    );
    assert.equal(
      db.prepare("SELECT description FROM cards").get()!.description,
      "以前の説明",
    );
  } finally {
    db.close();
  }
});

test("複数TODOの保存が途中で失敗したら全件取り消す", (t) => {
  const { store } = fixture(t);
  store.create(input);
  assert.throws(() =>
    store.createMany([
      input,
      { ...input, title: null } as unknown as TodoInput,
    ]),
  );
  assert.equal(store.list().length, 1);
  // ロールバック後にも保存できます。
  store.create(input);
  assert.equal(store.list().length, 2);
});

test("キー未設定なら外部通信せず、キーがあれば実APIを選ぶ", async () => {
  for (const apiKey of [undefined, "", "   "]) {
    const ai = createAiService({
      apiKey,
      model: "test",
      fetch: async () => {
        throw new Error("外部通信は禁止");
      },
    });
    assert.equal(ai.mode, "mock");
    assert.ok((await ai.generate("旅行したい")).length > 0);
  }
  assert.equal(
    createAiService({ apiKey: "fake-key", model: "test" }).mode,
    "openai",
  );
});

test("Responses APIにTODOのJSON形式を指定し、トークン上限を渡さない", async () => {
  const ai = createAiService({
    apiKey: "fake-key",
    model: "workshop-model",
    fetch: async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(init!.body as string);
      assert.equal(body.model, "workshop-model");
      assert.equal(body.input, "料理したい");
      assert.equal(body.store, false);
      assert.equal("max_output_tokens" in body, false);
      assert.match(body.instructions, /TODO/);
      assert.equal(body.text.format.type, "json_schema");
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(body.text.format.schema.required, ["theme", "todos"]);
      assert.equal(body.text.format.schema.properties.theme.type, "string");
      assert.equal(
        "theme" in body.text.format.schema.properties.todos.items.properties,
        false,
      );
      assert.deepEqual(
        body.text.format.schema.properties.todos.items.properties.priority.enum,
        ["high", "medium", "low"],
      );
      assert.equal(
        "maxItems" in body.text.format.schema.properties.todos,
        false,
      );
      return aiResponse(
        JSON.stringify({
          theme: "自炊を始める",
          todos: drafts.map(({ theme, ...todo }) => todo),
        }),
      );
    },
  });
  assert.deepEqual(await ai.generate("料理したい"), drafts);
});

test("入力ごとに要約テーマを1つ作り、その回のすべてのTODOへ保存する", async (t) => {
  const plans = [
    {
      goal: "機械学習に入門してMNISTを解くNNを実装したい",
      theme: "MNISTで学ぶニューラルネットワーク",
    },
    { goal: "来月から自炊を始めたい", theme: "初心者の自炊入門" },
  ];
  const ai = createAiService({
    apiKey: "fake-key",
    model: "test",
    fetch: async (url, init) => {
      const request = JSON.parse(init!.body as string);
      const plan = plans.find((item) => item.goal === request.input)!;
      return aiResponse(
        JSON.stringify({
          theme: plan.theme,
          todos: [
            {
              title: "必要なものを調べる",
              description: "準備するものを整理する",
              priority: "high",
            },
            {
              title: "実際に試す",
              description: "小さく試して振り返る",
              priority: "medium",
            },
          ],
        }),
      );
    },
  });
  const { app, store } = fixture(t, ai);
  for (const plan of plans) {
    const response = await app.request(
      "/api/todos/generate",
      json({ goal: plan.goal }),
    );
    assert.equal(response.status, 201);
    const { todos } = await response.json();
    assert.equal(todos.length, 2);
    assert.ok(todos.every((todo: TodoInput) => todo.theme === plan.theme));
  }
  const saved = store.list();
  assert.equal(saved.length, 4);
  for (const plan of plans) {
    assert.equal(saved.filter((todo) => todo.theme === plan.theme).length, 2);
  }
});

test("空・未完了・拒否の応答を成功とせず、API失敗時も再試行しない", async () => {
  for (const response of [
    aiResponse(""),
    aiResponse('{"todos":[]}', "incomplete"),
    aiResponse('{"todos":[]}'),
    new Response(
      JSON.stringify({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "refusal", refusal: "拒否" }] },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  ]) {
    const ai = createAiService({
      apiKey: "fake-key",
      model: "test",
      fetch: async () => response,
    });
    await assert.rejects(ai.generate("料理したい"));
  }
  let calls = 0;
  const ai = createAiService({
    apiKey: "fake-key",
    model: "test",
    fetch: async () => {
      calls++;
      return new Response('{"error":{"message":"失敗"}}', {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await assert.rejects(ai.generate("料理したい"));
  assert.equal(calls, 1);
});

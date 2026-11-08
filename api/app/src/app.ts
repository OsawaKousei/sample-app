import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import OpenAI from "openai";
import { PRIORITIES, STATUSES } from "../../../shared/board.ts";
import type { TodoInput } from "../../../shared/board.ts";
import type { Store } from "./database.ts";
import type { AiService } from "./ai.ts";

// 必須項目と選択肢だけを確認します。文字数や利用回数の制限は設けません。
function readTodo(body: TodoInput | null): TodoInput {
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    typeof body.description !== "string" ||
    typeof body.theme !== "string" ||
    !body.theme.trim() ||
    !PRIORITIES.includes(body.priority) ||
    !STATUSES.includes(body.status)
  ) {
    throw new HTTPException(400, {
      message: "タイトル・テーマ・優先度・ステータスを確認してください。",
    });
  }
  return {
    title: body.title.trim(),
    description: body.description.trim(),
    theme: body.theme.trim(),
    priority: body.priority,
    status: body.status,
  };
}

export function createApp({ store, ai }: { store: Store; ai: AiService }) {
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.get("/api/todos", (c) => c.json({ todos: store.list() }));

  app.post("/api/todos", async (c) => {
    const input = readTodo(await c.req.json());
    return c.json({ todo: store.create(input) }, 201);
  });

  app.put("/api/todos/:id", async (c) => {
    const input = readTodo(await c.req.json());
    const todo = store.update(c.req.param("id"), input);
    if (!todo) return c.json({ error: "TODOが見つかりません。" }, 404);
    return c.json({ todo });
  });

  app.delete("/api/todos/:id", (c) => {
    if (!store.remove(c.req.param("id"))) {
      return c.json({ error: "TODOが見つかりません。" }, 404);
    }
    return c.body(null, 204);
  });

  app.post("/api/todos/generate", async (c) => {
    const body = await c.req.json<{ goal?: string } | null>();
    if (typeof body?.goal !== "string" || !body.goal.trim()) {
      return c.json({ error: "やりたいことを入力してください。" }, 400);
    }

    let inputs: TodoInput[];
    try {
      const drafts = await ai.generate(body.goal.trim());
      inputs = drafts.map((draft) => readTodo({ ...draft, status: "todo" }));
    } catch (error) {
      // APIキーやSDKの内部情報は画面に返しません。失敗時のサンプル代用もしません。
      let message =
        "AIでTODOを生成できませんでした。APIキー・モデル・接続状況を確認してください。";
      if (error instanceof OpenAI.APIError) {
        if (error.code === "credit_balance_exhausted") {
          message =
            "OpenAI APIのクレジット残高が不足しています。プラットフォームの請求設定を確認してください。";
        } else if (error.code === "insufficient_quota") {
          message =
            "OpenAI APIの利用枠が不足しています。プラットフォームの請求・利用設定を確認してください。";
        } else if (error.status === 401) {
          message =
            "OpenAI APIキーの認証に失敗しました。.envのキーを確認し、サーバーを再起動してください。";
        }
      }
      return c.json({ error: message }, 502);
    }
    return c.json({ todos: store.createMany(inputs), mode: ai.mode }, 201);
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
      return c.json({ error: "JSONの形式を確認してください。" }, 400);
    return c.json(
      {
        error:
          "データの読み書きに失敗しました。APIの起動と保存先を確認してください。",
      },
      500,
    );
  });
  app.notFound((c) =>
    c.json({ error: "ページまたはAPIが見つかりません。" }, 404),
  );
  return app;
}

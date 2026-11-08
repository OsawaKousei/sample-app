import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { CATEGORIES, STATUSES } from "../../../shared/board.ts";
import type { CardInput } from "../../../shared/board.ts";
import type { Store } from "./database.ts";
import type { AiService } from "./ai.ts";

function validateCard(value: unknown): CardInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HTTPException(400, {
      message: "カードの形式が正しくありません。",
    });
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.trim().length > 120
  ) {
    throw new HTTPException(400, {
      message: "タイトルは1〜120文字で入力してください。",
    });
  }
  if (
    typeof input.description !== "string" ||
    input.description.length > 4000
  ) {
    throw new HTTPException(400, {
      message: "説明は4,000文字以内で入力してください。",
    });
  }
  if (
    !CATEGORIES.includes(input.category as CardInput["category"]) ||
    !STATUSES.includes(input.status as CardInput["status"])
  ) {
    throw new HTTPException(400, {
      message: "カテゴリまたはステータスが正しくありません。",
    });
  }
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category as CardInput["category"],
    status: input.status as CardInput["status"],
  };
}

export function createApp(options: {
  store: Store;
  ai: AiService;
  dailyLimit: number;
}) {
  const { store, ai, dailyLimit } = options;
  const app = new Hono();
  const pending = new Set<string>();

  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 32 * 1024,
      onError: (c) => c.json({ error: "送信データが大きすぎます。" }, 413),
    }),
  );
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      origin &&
      ![
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        new URL(c.req.url).origin,
      ].includes(origin)
    ) {
      return c.json(
        { error: "この接続元からの更新は許可されていません。" },
        403,
      );
    }
    await next();
  });

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.get("/api/config", (c) =>
    c.json({ aiMode: ai.mode, aiAvailable: ai.available, dailyLimit }),
  );
  app.get("/api/cards", (c) => {
    const q = (c.req.query("q") || "").toLocaleLowerCase();
    const category = c.req.query("category");
    const status = c.req.query("status");
    return c.json({
      cards: store
        .list()
        .filter(
          (card) =>
            (!q ||
              `${card.title}\n${card.description}`
                .toLocaleLowerCase()
                .includes(q)) &&
            (!category || card.category === category) &&
            (!status || card.status === status),
        ),
    });
  });

  app.get("/api/cards/:id", (c) => {
    const card = store.get(c.req.param("id"));
    if (!card) return c.json({ error: "カードが見つかりません。" }, 404);
    return c.json({ card });
  });
  app.post("/api/cards", async (c) => {
    const input = validateCard(
      await c.req.json().catch(() => {
        throw new HTTPException(400, {
          message: "JSONの形式が正しくありません。",
        });
      }),
    );
    return c.json({ card: store.create(input) }, 201);
  });
  app.put("/api/cards/:id", async (c) => {
    const id = c.req.param("id");
    if (!store.get(id))
      return c.json({ error: "カードが見つかりません。" }, 404);
    const input = validateCard(
      await c.req.json().catch(() => {
        throw new HTTPException(400, {
          message: "JSONの形式が正しくありません。",
        });
      }),
    );
    return c.json({ card: store.update(id, input) });
  });
  app.delete("/api/cards/:id", (c) => {
    if (!store.remove(c.req.param("id")))
      return c.json({ error: "カードが見つかりません。" }, 404);
    return c.body(null, 204);
  });

  app.post("/api/cards/:id/analyze", async (c) => {
    const card = store.get(c.req.param("id"));
    if (!card) return c.json({ error: "カードが見つかりません。" }, 404);
    if (!ai.available || ai.mode === "disabled")
      return c.json(
        { error: "AI機能は未設定です。カードの登録・編集はそのまま使えます。" },
        503,
      );
    if (pending.has(card.id))
      return c.json(
        { error: "このカードを分析中です。少し待ってください。" },
        409,
      );
    if (ai.mode === "openai" && !store.reserveAiAttempt(dailyLimit)) {
      return c.json(
        {
          error:
            "本日のAI利用回数の上限に達しました。カードの登録・編集は引き続き使えます。",
        },
        429,
      );
    }
    pending.add(card.id);
    try {
      const text = await ai.analyze(card);
      const saved = store.saveAnalysis(
        card,
        text,
        ai.mode as "mock" | "openai",
      );
      if (!saved)
        return c.json(
          {
            error:
              "分析中にカードが変更されました。最新のカードでやり直してください。",
          },
          409,
        );
      return c.json({ card: saved });
    } catch {
      // SDKのエラー本文には機密情報が含まれ得るため、そのまま返さない。
      return c.json(
        {
          error:
            "AIに接続できませんでした。APIキー・利用枠・モデル設定を確認し、少し待ってから再試行してください。カードは保存されています。",
        },
        502,
      );
    } finally {
      pending.delete(card.id);
    }
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error("APIで予期しないエラーが発生しました。");
    return c.json(
      { error: "処理に失敗しました。時間をおいて再試行してください。" },
      500,
    );
  });
  app.notFound((c) =>
    c.json({ error: "ページまたはAPIが見つかりません。" }, 404),
  );
  return app;
}

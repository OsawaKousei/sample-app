import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Card, CardInput } from "../../../shared/board.ts";

const examples: CardInput[] = [
  {
    title: "冷蔵庫の食材から、今日の献立を",
    description:
      "残っている食材を入力すると、簡単に作れるレシピを提案するアプリ。買い物リストも一緒に作れたら、食品ロスを減らせそう。",
    category: "アプリ",
    status: "アイデア",
  },
  {
    title: "読んだ本の「ひとこと」を残す",
    description:
      "心に残った一節と自分の感想をセットで記録。あとからテーマ別に振り返って、学びをつなげたい。",
    category: "学び",
    status: "進行中",
  },
  {
    title: "週末の小さな冒険マップ",
    description:
      "近所の気になるカフェや公園を集める。予算と空き時間から、自分だけの散歩コースを考えよう。",
    category: "暮らし",
    status: "アイデア",
  },
  {
    title: "会議のあとに、次の一歩を",
    description:
      "会議メモから決まったこと・担当者・期限を整理する。チームで見返しやすい形にしたい。",
    category: "仕事",
    status: "アイデア",
  },
  {
    title: "毎日5分、英語で日記",
    description:
      "短い英語の日記を書いて、表現のヒントをもらう。完璧さより、毎日続けることを大切に。",
    category: "学び",
    status: "完了",
  },
  {
    title: "好きなことを持ち寄る勉強会",
    description:
      "月に一度、それぞれの「最近おもしろかったこと」を紹介。初めての人も参加しやすい場を作る。",
    category: "その他",
    status: "アイデア",
  },
];

export function openStore(path: string, seed = true) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const isNew = !db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cards'",
    )
    .get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 4000),
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      analysis TEXT,
      analyzedAt TEXT,
      analysisMode TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_usage (
      day TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0
    );
  `);

  const store = {
    close: () => db.close(),
    list: () =>
      db
        .prepare("SELECT * FROM cards ORDER BY updatedAt DESC, id")
        .all() as unknown as Card[],
    get: (id: string) =>
      db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as unknown as
        Card | undefined,
    create(input: CardInput) {
      const id = randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO cards (id, title, description, category, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.title,
        input.description,
        input.category,
        input.status,
        now,
        now,
      );
      return store.get(id)!;
    },
    update(id: string, input: CardInput) {
      const old = store.get(id)!;
      const contentChanged =
        old.title !== input.title || old.description !== input.description;
      db.prepare(
        `UPDATE cards SET title = ?, description = ?, category = ?, status = ?, updatedAt = ?,
        analysis = ?, analyzedAt = ?, analysisMode = ? WHERE id = ?`,
      ).run(
        input.title,
        input.description,
        input.category,
        input.status,
        new Date().toISOString(),
        contentChanged ? null : old.analysis,
        contentChanged ? null : old.analyzedAt,
        contentChanged ? null : old.analysisMode,
        id,
      );
      return store.get(id)!;
    },
    remove: (id: string) =>
      db.prepare("DELETE FROM cards WHERE id = ?").run(id).changes > 0,
    saveAnalysis(card: Card, text: string, mode: "mock" | "openai") {
      // AIを待つ間に別画面で編集・削除された場合、古い内容の結果を保存しない。
      const now = new Date().toISOString();
      const result = db
        .prepare(
          `UPDATE cards SET analysis = ?, analyzedAt = ?, analysisMode = ?, updatedAt = ?
        WHERE id = ? AND title = ? AND description = ?`,
        )
        .run(
          text,
          now,
          mode,
          now,
          card.id,
          card.title,
          card.description,
        );
      return result.changes > 0 ? store.get(card.id) : undefined;
    },
    reserveAiAttempt(
      limit: number,
      day = new Date().toISOString().slice(0, 10),
    ) {
      // 1文で予約するため、同時リクエストでも上限を超えません。失敗時も回数は戻しません。
      return Boolean(
        db
          .prepare(
            `INSERT INTO ai_usage (day, attempts) VALUES (?, 1)
        ON CONFLICT(day) DO UPDATE SET attempts = attempts + 1 WHERE attempts < ?
        RETURNING attempts`,
          )
          .get(day, limit),
      );
    },
  };

  // 初回だけ投入。参加者が全件削除した後に勝手に復活させません。
  if (isNew && seed) {
    db.exec("BEGIN");
    try {
      examples.forEach((example) => store.create(example));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return store;
}

export type Store = ReturnType<typeof openStore>;

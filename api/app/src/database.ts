import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Todo, TodoInput } from "../../../shared/board.ts";

export function openStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);

  // 既存のideas・cardsテーブルは削除せず、TODO用のテーブルを追加します。
  db.exec(`CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    theme TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  const store = {
    close: () => db.close(),
    list: () =>
      db
        .prepare("SELECT * FROM todos ORDER BY createdAt DESC, rowid DESC")
        .all() as unknown as Todo[],
    get: (id: string) =>
      db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as
        Todo | undefined,
    create(input: TodoInput): Todo {
      const todo = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      db.prepare(
        `INSERT INTO todos
        (id, title, description, theme, priority, status, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        todo.id,
        todo.title,
        todo.description,
        todo.theme,
        todo.priority,
        todo.status,
        todo.createdAt,
      );
      return todo;
    },
    createMany(inputs: TodoInput[]) {
      // 生成したTODOは、まとめて保存するか、すべて取り消すかのどちらかにします。
      db.exec("BEGIN");
      try {
        const todos = inputs.map((input) => store.create(input));
        db.exec("COMMIT");
        return todos;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    update(id: string, input: TodoInput) {
      db.prepare(
        `UPDATE todos SET title = ?, description = ?, theme = ?,
        priority = ?, status = ? WHERE id = ?`,
      ).run(
        input.title,
        input.description,
        input.theme,
        input.priority,
        input.status,
        id,
      );
      return store.get(id);
    },
    remove(id: string) {
      return db.prepare("DELETE FROM todos WHERE id = ?").run(id).changes > 0;
    },
  };
  return store;
}

export type Store = ReturnType<typeof openStore>;

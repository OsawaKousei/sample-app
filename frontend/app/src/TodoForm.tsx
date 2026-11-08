import { useState } from "react";
import type { FormEvent } from "react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "../../../shared/board.ts";
import type { Priority, Status, TodoInput } from "../../../shared/board.ts";

interface Props {
  initialValue?: TodoInput;
  pending: boolean;
  onSave: (input: TodoInput) => Promise<void>;
  onCancel: () => void;
}

export function TodoForm({ initialValue, pending, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState(
    initialValue?.description ?? "",
  );
  const [theme, setTheme] = useState(initialValue?.theme ?? "日常");
  const [priority, setPriority] = useState<Priority>(
    initialValue?.priority ?? "medium",
  );
  const [status, setStatus] = useState<Status>(initialValue?.status ?? "todo");

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSave({ title, description, theme, priority, status });
  }

  return (
    <section className="panel todo-form" aria-labelledby="form-title">
      <h2 id="form-title">{initialValue ? "TODOを編集" : "TODOを追加"}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={pending}>
          <label htmlFor="todo-title">
            タイトル <span className="required">必須</span>
          </label>
          <input
            id="todo-title"
            autoFocus
            required
            value={title}
            placeholder="例：読みたい本を3冊選ぶ"
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="todo-description">説明</label>
          <textarea
            id="todo-description"
            rows={3}
            value={description}
            placeholder="やることの詳細をメモしましょう"
            onChange={(event) => setDescription(event.target.value)}
          />
          <label htmlFor="todo-theme">
            テーマ <span className="required">必須</span>
          </label>
          <input
            id="todo-theme"
            required
            value={theme}
            placeholder="例：学習、仕事、暮らし"
            onChange={(event) => setTheme(event.target.value)}
          />
          <div className="form-row">
            <div>
              <label htmlFor="todo-priority">優先度</label>
              <select
                id="todo-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Priority)
                }
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="todo-status">ステータス</label>
              <select
                id="todo-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as Status)}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!title.trim() || !theme.trim()}
            >
              {pending ? "保存中…" : "保存する"}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

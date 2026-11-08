import { useEffect, useState } from "react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "../../../shared/board.ts";
import type { Status, Todo, TodoInput } from "../../../shared/board.ts";
import { api } from "./api";
import { AiPlanner } from "./AiPlanner";
import { TodoCard } from "./TodoCard";
import { TodoForm } from "./TodoForm";

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [groupBy, setGroupBy] = useState<"theme" | "priority">("theme");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  useEffect(() => {
    let active = true;
    api
      .list()
      .then((result) => {
        if (active) setTodos(result.todos);
      })
      .catch(() => {
        if (active)
          setError(
            "TODOを読み込めませんでした。APIの起動を確認して、ページを再読み込みしてください。",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 保存が成功してから画面を更新します。失敗したときは入力を残します。
  async function runAction(action: () => Promise<void>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "通信に失敗しました。");
    } finally {
      setPending(false);
    }
  }

  async function saveTodo(input: TodoInput) {
    await runAction(async () => {
      if (editing) {
        const { todo } = await api.update(editing.id, input);
        setTodos((current) =>
          current.map((item) => (item.id === todo.id ? todo : item)),
        );
      } else {
        const { todo } = await api.create(input);
        setTodos((current) => [todo, ...current]);
      }
      setShowForm(false);
      setEditing(null);
      setMessage("TODOを保存しました。");
    });
  }

  async function changeStatus(todo: Todo, status: Status) {
    await runAction(async () => {
      const result = await api.update(todo.id, { ...todo, status });
      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? result.todo : item)),
      );
      setMessage(`「${todo.title}」を${STATUS_LABELS[status]}にしました。`);
    });
  }

  async function deleteTodo(todo: Todo) {
    if (!window.confirm(`「${todo.title}」を削除しますか？`)) return;
    await runAction(async () => {
      await api.remove(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
      if (editing?.id === todo.id) {
        setShowForm(false);
        setEditing(null);
      }
      setMessage("TODOを削除しました。");
    });
  }

  async function generateTodos(goal: string) {
    setGenerating(true);
    await runAction(async () => {
      const result = await api.generate(goal);
      setTodos((current) => [...result.todos.reverse(), ...current]);
      setStatusFilter("all");
      setMessage(
        `${result.todos.length}件のTODOを追加しました。${result.mode === "mock" ? "APIキー未設定のため、サンプルを使いました。" : ""}`,
      );
    });
    setGenerating(false);
  }

  const visibleTodos = todos.filter(
    (todo) => statusFilter === "all" || todo.status === statusFilter,
  );
  const groupNames =
    groupBy === "theme"
      ? [...new Set(visibleTodos.map((todo) => todo.theme))]
      : [...PRIORITIES];
  const groups = groupNames
    .map((name) => ({
      name,
      label:
        groupBy === "theme"
          ? name
          : PRIORITY_LABELS[name as keyof typeof PRIORITY_LABELS],
      todos: visibleTodos.filter((todo) => todo[groupBy] === name),
    }))
    .filter((group) => group.todos.length > 0);
  const disabled = loading || pending;

  return (
    <div className="app">
      <header className="app-header">
        <a className="app-name" href="/">
          <span className="app-mark" aria-hidden="true">
            ✓
          </span>{" "}
          AI TODOプランナー
        </a>
        <span className="header-note">じぶんのペースで、ひとつずつ。</span>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">毎日の「やりたい」を、行動に。</p>
            <h1>今日の一歩を、ここから。</h1>
            <p>TODOを整理して、できることから始めましょう。</p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={disabled}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            ＋ TODOを追加
          </button>
        </section>
        <div className="summary" aria-label="TODOの状況">
          {STATUSES.map((status) => (
            <p key={status}>
              <span className={`status-dot status-${status}`} />
              {STATUS_LABELS[status]}{" "}
              <strong>
                {todos.filter((todo) => todo.status === status).length}
              </strong>
            </p>
          ))}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <p className="action-message" role="status">
          {generating
            ? "AIがTODOを考えています。そのままお待ちください。"
            : message}
        </p>
        <div className="workspace">
          <aside>
            <AiPlanner
              pending={disabled}
              generating={generating}
              onGenerate={generateTodos}
            />
          </aside>
          <section className="todo-board" aria-labelledby="board-title">
            {showForm && (
              <TodoForm
                key={editing?.id ?? "new"}
                initialValue={editing ?? undefined}
                pending={pending}
                onSave={saveTodo}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            )}
            <div className="board-heading">
              <h2 id="board-title">
                マイTODO <span>{todos.length}</span>
              </h2>
              <div className="filter-label">
                <label htmlFor="status-filter">表示</label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as Status | "all")
                  }
                >
                  <option value="all">すべて</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="view-switch" aria-label="TODOの並べ方">
              <button
                type="button"
                aria-pressed={groupBy === "theme"}
                onClick={() => setGroupBy("theme")}
              >
                テーマ別
              </button>
              <button
                type="button"
                aria-pressed={groupBy === "priority"}
                onClick={() => setGroupBy("priority")}
              >
                優先度別
              </button>
            </div>
            {loading ? (
              <p className="empty-state" role="status">
                TODOを読み込んでいます…
              </p>
            ) : groups.length === 0 ? (
              <div className="empty-state">
                <h3>
                  {todos.length === 0
                    ? "最初のTODOをつくりましょう"
                    : "該当するTODOはありません"}
                </h3>
                <p>
                  {todos.length === 0
                    ? "自分で追加することも、AIと一緒に考えることもできます。"
                    : "表示するステータスを切り替えてみましょう。"}
                </p>
              </div>
            ) : (
              groups.map((group) => {
                const cards = (
                  <div className="todo-grid">
                    {group.todos.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        pending={disabled}
                        onStatusChange={changeStatus}
                        onDelete={deleteTodo}
                        onEdit={(item) => {
                          setEditing(item);
                          setShowForm(true);
                        }}
                      />
                    ))}
                  </div>
                );

                // detailsは、open属性を付けなければ最初は折りたたまれます。
                if (groupBy === "theme") {
                  return (
                    <details
                      className="todo-group theme-group"
                      key={group.name}
                    >
                      <summary className="group-heading">
                        {group.label}
                        <span>{group.todos.length}件</span>
                      </summary>
                      {cards}
                    </details>
                  );
                }

                return (
                  <section
                    className="todo-group"
                    key={group.name}
                    aria-label={`優先度：${group.label}`}
                  >
                    <h3 className="group-heading">
                      優先度：{group.label}
                      <span>{group.todos.length}</span>
                    </h3>
                    {cards}
                  </section>
                );
              })
            )}
          </section>
        </div>
      </main>
      <footer className="app-footer">
        小さな行動を積み重ねて、やりたいことを形に。
      </footer>
    </div>
  );
}

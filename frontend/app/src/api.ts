import type { Todo, TodoInput } from "../../../shared/board.ts";

// HTTP通信をここにまとめ、コンポーネントから使います。
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new Error(
      "APIに接続できませんでした。開発サーバーの起動を確認してください。",
    );
  });
  if (!response.ok) {
    const result = await response.json();
    throw new Error(result.error);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  list: () => request<{ todos: Todo[] }>("/api/todos"),
  create: (input: TodoInput) =>
    request<{ todo: Todo }>("/api/todos", "POST", input),
  update: (id: string, input: TodoInput) =>
    request<{ todo: Todo }>(`/api/todos/${id}`, "PUT", input),
  remove: (id: string) => request<void>(`/api/todos/${id}`, "DELETE"),
  generate: (goal: string) =>
    request<{ todos: Todo[]; mode: "mock" | "openai" }>(
      "/api/todos/generate",
      "POST",
      { goal },
    ),
};

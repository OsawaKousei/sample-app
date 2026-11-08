import type { AppConfig, Card, CardInput } from "../../../shared/board.ts";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error || `通信に失敗しました（${response.status}）。`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  cards: () => request<{ cards: Card[] }>("/cards"),
  config: () => request<AppConfig>("/config"),
  save: (input: CardInput, id?: string) =>
    request<{ card: Card }>(id ? `/cards/${id}` : "/cards", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  remove: (id: string) => request<void>(`/cards/${id}`, { method: "DELETE" }),
  analyze: (id: string) =>
    request<{ card: Card }>(`/cards/${id}/analyze`, { method: "POST" }),
};

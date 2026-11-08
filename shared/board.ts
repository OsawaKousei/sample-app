// 画面とAPIで同じ選択肢・型を使います。
export const PRIORITIES = ["high", "medium", "low"] as const;
export const STATUSES = ["todo", "doing", "done"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
export const STATUS_LABELS: Record<Status, string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
};

export interface TodoDraft {
  title: string;
  description: string;
  theme: string;
  priority: Priority;
}

export interface TodoInput extends TodoDraft {
  status: Status;
}

export interface Todo extends TodoInput {
  id: string;
  createdAt: string;
}

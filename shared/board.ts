// フロントエンドとAPIで共有する選択肢・データの形。
export const CATEGORIES = [
  "アプリ",
  "暮らし",
  "学び",
  "仕事",
  "その他",
] as const;
export const STATUSES = ["アイデア", "進行中", "完了"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type AiMode = "mock" | "openai" | "disabled";

export interface CardInput {
  title: string;
  description: string;
  category: Category;
  status: Status;
}

export interface Card extends CardInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  analysis: string | null;
  analyzedAt: string | null;
  analysisMode: "mock" | "openai" | null;
}

export interface AppConfig {
  aiMode: AiMode;
  aiAvailable: boolean;
  dailyLimit: number;
}

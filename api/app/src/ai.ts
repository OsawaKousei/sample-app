import OpenAI from "openai";
import { PRIORITIES } from "../../../shared/board.ts";
import type { TodoDraft } from "../../../shared/board.ts";

export const TODO_INSTRUCTIONS = `あなたは、やりたいことを具体的なTODOに分けるアシスタントです。
入力された目標を達成するための行動を、日本語で提案してください。
各TODOには、短いタイトル、具体的な説明、分類用のテーマ、優先度を付けてください。
同じ種類の行動には同じテーマ名を使ってください。
優先度はhigh（高）、medium（中）、low（低）で表します。
初心者が何から始めればよいか分かる、小さな行動に分けてください。`;

// Responses APIに、TODOのJSON形式を指定します。
const TODO_SCHEMA = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          theme: { type: "string" },
          priority: { type: "string", enum: [...PRIORITIES] },
        },
        required: ["title", "description", "theme", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["todos"],
  additionalProperties: false,
};

export interface AiService {
  mode: "mock" | "openai";
  generate: (goal: string) => Promise<TodoDraft[]>;
}

export function createAiService(options: {
  apiKey?: string;
  model: string;
  fetch?: typeof fetch;
}): AiService {
  const apiKey = options.apiKey?.trim();
  const client = apiKey
    ? new OpenAI({ apiKey, fetch: options.fetch, maxRetries: 0 })
    : null;

  return {
    mode: client ? "openai" : "mock",
    async generate(goal) {
      // キーがない場合だけサンプルを使い、外部へ通信しません。
      if (!client) {
        return [
          {
            title: "目標を具体的にする",
            description: `「${goal}」で実現したいことを書き出しましょう。`,
            theme: "準備",
            priority: "high",
          },
          {
            title: "必要なものを調べる",
            description:
              "必要な道具や知識を調べ、準備するものをメモしましょう。",
            theme: "準備",
            priority: "medium",
          },
          {
            title: "小さく試して振り返る",
            description:
              "最初の行動を一つ試し、できたことと次にやることを記録しましょう。",
            theme: "実践",
            priority: "low",
          },
        ];
      }

      const response = await client.responses.create({
        model: options.model,
        instructions: TODO_INSTRUCTIONS,
        input: goal,
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "todo_plan",
            strict: true,
            schema: TODO_SCHEMA,
          },
        },
      });
      if (response.status !== "completed" || !response.output_text) {
        throw new Error("TODOを生成できませんでした。");
      }
      const plan = JSON.parse(response.output_text) as { todos: TodoDraft[] };
      if (plan.todos.length === 0) throw new Error("TODOがありませんでした。");
      return plan.todos;
    },
  };
}

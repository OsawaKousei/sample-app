import OpenAI from "openai";
import { PRIORITIES } from "../../../shared/board.ts";
import type { TodoDraft } from "../../../shared/board.ts";

export const TODO_INSTRUCTIONS = `あなたは、やりたいことを具体的なTODOに分けるアシスタントです。
入力された目標を達成するための行動を、日本語で提案してください。
まず、入力全体の目的を短い日本語の見出しに要約し、テーマを1つだけ作成してください。
テーマは「MNISTで学ぶニューラルネットワーク」のように、入力の内容が分かるものにしてください。
「準備」「実践」などのサブテーマには分けないでください。
各TODOには、短いタイトル、具体的な説明、優先度を付けてください。
優先度はhigh（高）、medium（中）、low（低）で表します。
初心者が何から始めればよいか分かる、小さな行動に分けてください。`;

// 入力全体のテーマを1つと、TODOの配列を受け取ります。
const TODO_SCHEMA = {
  type: "object",
  properties: {
    theme: { type: "string" },
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: [...PRIORITIES] },
        },
        required: ["title", "description", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["theme", "todos"],
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
        // サンプルでは、入力の冒頭を短い共通テーマとして使います。
        const theme = goal.length > 30 ? `${goal.slice(0, 30)}…` : goal;
        return [
          {
            title: "目標を具体的にする",
            description: `「${goal}」で実現したいことを書き出しましょう。`,
            theme,
            priority: "high",
          },
          {
            title: "必要なものを調べる",
            description:
              "必要な道具や知識を調べ、準備するものをメモしましょう。",
            theme,
            priority: "medium",
          },
          {
            title: "小さく試して振り返る",
            description:
              "最初の行動を一つ試し、できたことと次にやることを記録しましょう。",
            theme,
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
      const plan = JSON.parse(response.output_text) as {
        theme: string;
        todos: Omit<TodoDraft, "theme">[];
      };
      if (plan.todos.length === 0) throw new Error("TODOがありませんでした。");
      // 同じ入力から生成したTODOには、すべて同じテーマを設定します。
      return plan.todos.map((todo) => ({ ...todo, theme: plan.theme }));
    },
  };
}

import { useState } from "react";
import type { FormEvent } from "react";

interface Props {
  pending: boolean;
  generating: boolean;
  onGenerate: (goal: string) => Promise<void>;
}

export function AiPlanner({ pending, generating, onGenerate }: Props) {
  const [goal, setGoal] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    void onGenerate(goal);
  }

  return (
    <section className="panel ai-planner" aria-labelledby="ai-title">
      <span className="eyebrow">小さな一歩を見つけよう</span>
      <h2 id="ai-title">AIとTODOをつくる</h2>
      <p>
        やりたいことを伝えると、AIが内容を要約したテーマをつくり、その中にTODOを追加します。
      </p>
      <form onSubmit={submit}>
        <label htmlFor="goal">どんなことをしたいですか？</label>
        <textarea
          id="goal"
          rows={6}
          required
          value={goal}
          disabled={pending}
          placeholder="例：来月から自炊を始めたい。料理は初心者なので、準備することから考えたい。"
          onChange={(event) => setGoal(event.target.value)}
        />
        <button
          className="primary-button generate-button"
          type="submit"
          disabled={pending || !goal.trim()}
        >
          {generating ? "TODOを考えています…" : "AIでTODOを生成"}
        </button>
      </form>
      <p className="hint">生成したTODOは、あとから自由に編集できます。</p>
    </section>
  );
}

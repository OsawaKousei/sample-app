import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, X, Check } from "lucide-react";
import { CATEGORIES, STATUSES } from "../../../shared/board.ts";
import type { Card, CardInput, AppConfig } from "../../../shared/board.ts";
import { api } from "./api";

const blank: CardInput = {
  title: "",
  description: "",
  category: "アプリ",
  status: "アイデア",
};

export function CardDialog({
  card,
  config,
  onClose,
  onChange,
  onDelete,
}: {
  card: Card | null;
  config: AppConfig | null;
  onClose: () => void;
  onChange: (card: Card, message: string) => void;
  onDelete: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState(card);
  const [input, setInput] = useState<CardInput>(
    card
      ? {
          title: card.title,
          description: card.description,
          category: card.category,
          status: card.status,
        }
      : blank,
  );
  const [busy, setBusy] = useState<"save" | "ai" | "delete" | null>(null);
  const [error, setError] = useState("");
  const dirty = record
    ? input.title !== record.title ||
      input.description !== record.description ||
      input.category !== record.category ||
      input.status !== record.status
    : Boolean(input.title || input.description);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close() {
    if (busy) return;
    if (dirty && !window.confirm("保存していない変更を破棄しますか？")) return;
    onClose();
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError("");
    try {
      const { card: saved } = await api.save(input, record?.id);
      onChange(
        saved,
        record ? "カードを更新しました。" : "新しいアイデアを保存しました。",
      );
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (!record) return;
    setBusy("ai");
    setError("");
    try {
      const { card: saved } = await api.analyze(record.id);
      setRecord(saved);
      onChange(saved, "分析結果をカードに保存しました。");
    } catch (error) {
      setError(error instanceof Error ? error.message : "分析に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (
      !record ||
      !window.confirm(
        `「${record.title}」を削除しますか？この操作は取り消せません。`,
      )
    )
      return;
    setBusy("delete");
    setError("");
    try {
      await api.remove(record.id);
      onDelete(record.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "削除に失敗しました。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="card-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="dialog-header">
        <div>
          <p className="eyebrow">YOUR NEXT IDEA</p>
          <h2 id="dialog-title">
            {record ? "アイデアを育てる" : "新しいアイデア"}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={close}
          disabled={Boolean(busy)}
          aria-label="閉じる"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={Boolean(busy)}>
          <label className="field-label" htmlFor="title">
            タイトル <span>必須</span>
          </label>
          <input
            id="title"
            autoFocus
            required
            maxLength={120}
            placeholder="どんなことを思いつきましたか？"
            value={input.title}
            onChange={(event) =>
              setInput({ ...input, title: event.target.value })
            }
          />
          <label className="field-label" htmlFor="description">
            アイデアのメモ
          </label>
          <textarea
            id="description"
            rows={5}
            maxLength={4000}
            placeholder="きっかけ、解決したいこと、実現してみたいことなど…"
            value={input.description}
            onChange={(event) =>
              setInput({ ...input, description: event.target.value })
            }
          />
          <div className="form-columns">
            <div>
              <label className="field-label" htmlFor="edit-category">
                カテゴリ
              </label>
              <select
                id="edit-category"
                value={input.category}
                onChange={(event) =>
                  setInput({
                    ...input,
                    category: event.target.value as CardInput["category"],
                  })
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-status">
                ステータス
              </label>
              <select
                id="edit-status"
                value={input.status}
                onChange={(event) =>
                  setInput({
                    ...input,
                    status: event.target.value as CardInput["status"],
                  })
                }
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {record && (
          <section
            className="analysis-panel"
            aria-labelledby="analysis-title"
            aria-busy={busy === "ai"}
          >
            <div className="analysis-heading">
              <h3 id="analysis-title">
                <Sparkles size={17} /> AIと、もう一歩
              </h3>
              <span className="tiny-badge">
                {config?.aiMode === "mock"
                  ? "練習モード"
                  : config?.aiAvailable
                    ? "OpenAI"
                    : "未設定"}
              </span>
            </div>
            <p className="muted">
              よいところ・育てるヒント・最初の一歩を提案し、結果を自動保存します。
            </p>
            {record.analysis && (
              <div className="analysis-result">
                <p className="analysis-saved">
                  <Check size={13} /> 保存済み ·{" "}
                  {record.analysisMode === "mock" ? "サンプル応答" : "OpenAI"} ·{" "}
                  {new Date(record.analyzedAt!).toLocaleString("ja-JP")}
                </p>
                <p>{record.analysis}</p>
              </div>
            )}
            {dirty && (
              <p className="help-text">
                変更を保存してから、AIで分析できます。
              </p>
            )}
            {!config?.aiAvailable && (
              <p className="help-text">
                AIは未設定です。カードの登録・編集は引き続き使えます。
              </p>
            )}
            <button
              className="button ai-button"
              type="button"
              disabled={Boolean(busy) || dirty || !config?.aiAvailable}
              onClick={analyze}
            >
              {busy === "ai" ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {busy === "ai"
                ? "アイデアを分析中…"
                : record.analysis
                  ? "もう一度分析する"
                  : "AIで分析して保存"}
            </button>
          </section>
        )}

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          {record && (
            <button
              className="button danger-button"
              type="button"
              disabled={Boolean(busy)}
              onClick={remove}
            >
              <Trash2 size={16} /> 削除
            </button>
          )}
          <div className="footer-actions">
            <button
              className="button secondary-button"
              type="button"
              onClick={close}
              disabled={Boolean(busy)}
            >
              キャンセル
            </button>
            <button
              className="button primary-button"
              type="submit"
              disabled={Boolean(busy) || !input.title.trim()}
            >
              {busy === "save" && <Loader2 size={16} className="spin" />}
              保存する
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Coffee,
  Grid2X2,
  LayoutGrid,
  Lightbulb,
  List,
  Plus,
  Search,
  Shapes,
  Sparkles,
  Sprout,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, STATUSES } from "../../../shared/board.ts";
import type {
  AppConfig,
  Card,
  Category,
  Status,
} from "../../../shared/board.ts";
import { api } from "./api";
import { CardDialog } from "./CardDialog";

const categoryIcons: Record<Category, LucideIcon> = {
  アプリ: Grid2X2,
  暮らし: Coffee,
  学び: BookOpen,
  仕事: BriefcaseBusiness,
  その他: Shapes,
};
const categoryClasses: Record<Category, string> = {
  アプリ: "app",
  暮らし: "life",
  学び: "learn",
  仕事: "work",
  その他: "other",
};
const statusIcons: Record<Status, LucideIcon> = {
  アイデア: Circle,
  進行中: CircleDot,
  完了: Check,
};

export function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dialog, setDialog] = useState<{ card: Card | null } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [data, settings] = await Promise.all([api.cards(), api.config()]);
      setCards(data.cards);
      setConfig(settings);
    } catch {
      setError(
        "ボードを読み込めませんでした。APIが起動しているか確認してください。",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const normalized = query.trim().toLocaleLowerCase();
  const inCategory = cards.filter(
    (card) => !category || card.category === category,
  );
  const visible = inCategory.filter(
    (card) =>
      (!status || card.status === status) &&
      (!normalized ||
        `${card.title}\n${card.description}`
          .toLocaleLowerCase()
          .includes(normalized)),
  );
  const hasFilters = Boolean(query || category || status);
  function clearFilters() {
    setQuery("");
    setCategory("");
    setStatus("");
  }

  function changed(card: Card, message: string) {
    setCards((previous) => [
      card,
      ...previous.filter((item) => item.id !== card.id),
    ]);
    setNotice(message);
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        メインコンテンツへ
      </a>
      <aside className="sidebar" aria-label="ボードのナビゲーション">
        <a className="brand" href="/" aria-label="AIアイデアボード ホーム">
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          <span>
            idea board
            <span className="brand-caption">AIと、ひらめきのその先へ。</span>
          </span>
        </a>
        <div className="workspace-label">
          ワークスペース <span>PERSONAL</span>
        </div>
        <button
          className={`nav-item ${!category ? "active" : ""}`}
          onClick={() => {
            setCategory("");
            setStatus("");
          }}
        >
          <LayoutGrid size={18} />
          <span>すべてのアイデア</span>
          <span className="nav-count">{cards.length}</span>
        </button>
        <div className="nav-section-label">カテゴリ</div>
        <nav className="category-nav" aria-label="カテゴリ">
          {CATEGORIES.map((name) => {
            const Icon = categoryIcons[name];
            return (
              <button
                className={`nav-item ${category === name ? "active" : ""}`}
                key={name}
                aria-pressed={category === name}
                onClick={() => setCategory(category === name ? "" : name)}
              >
                <Icon
                  size={17}
                  className={`category-text-${categoryClasses[name]}`}
                />
                <span>{name}</span>
                <span className="nav-count">
                  {cards.filter((card) => card.category === name).length}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="workshop-card">
            <span className="workshop-icon">
              <Sprout size={20} />
            </span>
            <p>
              小さくつくって、
              <br />
              大きく育てよう。
            </p>
            <span>
              このボードが、あなたの
              <br />
              最初のWebアプリです。
            </span>
            <button
              onClick={() => setShowGuide(!showGuide)}
              aria-expanded={showGuide}
            >
              使い方を見る <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="sidebar-footnote">
            <span className="online-dot" /> ローカルワークスペース
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>ワークスペース</span>
            <ChevronRight size={14} />
            <strong>マイボード</strong>
          </div>
          <div className="topbar-right">
            <span className="workshop-label">AI WEB APP WORKSHOP</span>
            <span className="avatar" aria-label="自分のワークスペース">
              ME
            </span>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">A LITTLE IDEA, A NEW POSSIBILITY.</p>
              <h1>
                ひらめきを、育てよう<span className="heading-dot">.</span>
              </h1>
              <p className="page-description">
                思いついたことを集めて、AIと一緒に次の一歩へ。
              </p>
            </div>
            <button
              className="button primary-button add-button"
              onClick={() => setDialog({ card: null })}
            >
              <Plus size={18} />
              アイデアを追加
            </button>
          </div>

          {showGuide && (
            <section className="guide-panel" aria-label="使い方">
              <div>
                <h2>
                  <Sprout size={18} /> このボードの使い方
                </h2>
                <ol>
                  <li>「アイデアを追加」から、タイトルとメモを保存。</li>
                  <li>カテゴリとステータスで整理し、検索で見つける。</li>
                  <li>
                    カードを開いて「AIで分析して保存」で、次の一歩を考える。
                  </li>
                </ol>
                <p>
                  練習モードはサンプル応答です。第4回で実際のAIにつなげましょう。
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowGuide(false)}
                aria-label="使い方を閉じる"
              >
                <X size={18} />
              </button>
            </section>
          )}

          <section className="board" aria-label="アイデア一覧">
            <div className="board-heading">
              <h2>
                <LayoutGrid size={19} />
                {category || "マイボード"}{" "}
                <span className="count-badge">{inCategory.length}</span>
              </h2>
              <span className="board-caption">
                あなたの「やってみたい」を、ここに。
              </span>
            </div>
            <div className="board-controls">
              <div
                className="status-tabs"
                role="group"
                aria-label="ステータスで絞り込み"
              >
                {(["", ...STATUSES] as const).map((name) => (
                  <button
                    key={name}
                    className={`status-tab ${status === name ? "selected" : ""}`}
                    aria-pressed={status === name}
                    onClick={() => setStatus(name)}
                  >
                    {name === "" ? "すべて" : name}
                    <span>
                      {
                        inCategory.filter(
                          (card) => !name || card.status === name,
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>
              <div className="filter-row">
                <div className="search-box">
                  <Search size={17} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="アイデアを検索…"
                    aria-label="キーワード検索"
                  />
                </div>
                <label className="sr-only" htmlFor="filter-category">
                  カテゴリで絞り込み
                </label>
                <select
                  id="filter-category"
                  className="category-select"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as Category | "")
                  }
                >
                  <option value="">すべてのカテゴリ</option>
                  {CATEGORIES.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
                <div className="view-toggle" role="group" aria-label="表示方法">
                  <button
                    aria-label="グリッド表示"
                    aria-pressed={view === "grid"}
                    className={view === "grid" ? "selected" : ""}
                    onClick={() => setView("grid")}
                  >
                    <LayoutGrid size={17} />
                  </button>
                  <button
                    aria-label="リスト表示"
                    aria-pressed={view === "list"}
                    className={view === "list" ? "selected" : ""}
                    onClick={() => setView("list")}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>
            </div>
            <div className="results-line">
              <span>
                {hasFilters
                  ? `${visible.length}件のアイデアが見つかりました`
                  : `${cards.length}件のアイデア`}
              </span>
              {hasFilters && (
                <button onClick={clearFilters}>
                  絞り込みをクリア <X size={13} />
                </button>
              )}
              <span className="sort-caption">更新が新しい順</span>
            </div>

            {error ? (
              <div className="empty-state" role="alert">
                <p>{error}</p>
                <button className="button secondary-button" onClick={load}>
                  再読み込み
                </button>
              </div>
            ) : loading ? (
              <div className="cards-grid" role="status" aria-label="読み込み中">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="card-skeleton" />
                ))}
              </div>
            ) : (
              <>
                <div className={view === "grid" ? "cards-grid" : "cards-list"}>
                  {visible.map((card) => {
                    const Icon = categoryIcons[card.category];
                    const StatusIcon = statusIcons[card.status];
                    return (
                      <article
                        className={`idea-card category-${categoryClasses[card.category]}`}
                        key={card.id}
                      >
                        <button
                          className="card-open"
                          onClick={() => setDialog({ card })}
                          aria-label={`${card.title}を開く`}
                        >
                          <div className="card-top">
                            <span className="category-chip">
                              <Icon size={14} />
                              {card.category}
                            </span>
                            <ArrowUpRight size={17} className="card-arrow" />
                          </div>
                          <h3>{card.title}</h3>
                          <p className="card-description">
                            {card.description ||
                              "まだメモがありません。ひらめきの続きを書いてみましょう。"}
                          </p>
                        </button>
                        <div className="card-footer">
                          <span
                            className={`status-chip status-${STATUSES.indexOf(card.status)}`}
                          >
                            <StatusIcon size={12} />
                            {card.status}
                          </span>
                          {card.analysis ? (
                            <span className="analyzed-label">
                              <Sparkles size={12} />
                              {card.analysisMode === "mock"
                                ? "練習済み"
                                : "分析済み"}
                            </span>
                          ) : (
                            <time dateTime={card.updatedAt}>
                              {new Date(card.updatedAt).toLocaleDateString(
                                "ja-JP",
                                { month: "numeric", day: "numeric" },
                              )}
                            </time>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {view === "grid" && visible.length > 0 && (
                    <button
                      className="add-card"
                      onClick={() => setDialog({ card: null })}
                    >
                      <span>
                        <Plus size={23} />
                      </span>
                      <strong>次のひらめきを追加</strong>
                      <p>小さな思いつきから、はじめよう。</p>
                    </button>
                  )}
                </div>
                {visible.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Lightbulb size={30} />
                    </span>
                    <h3>
                      {hasFilters
                        ? "ぴったりのアイデアは、まだないようです"
                        : "はじめのひらめきを、ひとつ。"}
                    </h3>
                    <p>
                      {hasFilters
                        ? "キーワードや条件を変えて、もう一度探してみましょう。"
                        : "大きなアイデアでなくても大丈夫。気になることから書いてみましょう。"}
                    </p>
                    <button
                      className="button primary-button"
                      onClick={
                        hasFilters
                          ? clearFilters
                          : () => setDialog({ card: null })
                      }
                    >
                      {hasFilters ? "絞り込みをクリア" : "アイデアを追加"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <footer className="main-footer">
            <p>
              <Sparkles size={15} />{" "}
              まだまとまっていなくても大丈夫。ひらめきは、書きとめることから。
            </p>
            <span>
              {config?.aiMode === "mock"
                ? "AI 練習モード · 外部通信なし"
                : config?.aiAvailable
                  ? "OpenAI 接続モード"
                  : "AI 未設定 · ボードは利用できます"}
            </span>
          </footer>
        </main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <Check size={17} />
            {notice}
          </div>
        )}
      </div>
      {dialog && (
        <CardDialog
          card={dialog.card}
          config={config}
          onClose={() => setDialog(null)}
          onChange={changed}
          onDelete={(id) => {
            setCards((previous) => previous.filter((card) => card.id !== id));
            setNotice("カードを削除しました。");
          }}
        />
      )}
    </div>
  );
}

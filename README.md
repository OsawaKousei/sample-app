# AIアイデアボード

思いついたことをカードに残し、AIと一緒に育てる、全4回・各2時間のWebアプリ開発ワークショップ用サンプルです。

React + Vite + TypeScript / Hono + Node.js / SQLite / OpenAI Responses API を使います。ローカルPCで完結し、最初はAPIキーなしで使えます。

## 起動する

Node.js **24.13以降の24系** と npm、Git を用意し、このリポジトリを取得して、そのフォルダで実行します。SQLiteの別途インストールは不要です。

```sh
npm install
npm run setup:local
npm run dev
```

ブラウザーで **http://127.0.0.1:5173** を開きます。ReactとAPIが同時に起動し、初回は6枚のサンプルカードを作成します。停止はターミナルで `Ctrl+C`。

`setup:local` は `.env.example` から `.env` を作成します。既存の `.env` は上書きしません。`.env` がなくても、既定のモックモードで起動できます。

## できること

- カードの作成・一覧表示・編集・確認付き削除
- カテゴリとステータスによる分類、キーワードとの複合絞り込み
- グリッド／リスト表示、スマートフォン対応
- SQLiteへの自動保存と再起動後の復元
- AIによる分析・提案の生成とカードへの自動保存
- モック／実API／AI無効の切り替え、AI失敗時も使えるCRUD

カードを開いて「AIで分析して保存」を押すと、よいところ・育てるヒント・最初の一歩を表示します。初期状態の「練習モード」は外部通信も課金もありません。分析は最新1件を保存し、タイトルや説明を変更すると古い分析をクリアします。

## 教材

| 資料 | 内容 |
| --- | --- |
| [環境構築](docs/setup.md) | Windows / macOS、Node.js、VS Code、Git、Codex、Docker |
| [第1回](docs/lessons/01-getting-started.md) | 環境構築・起動・はじめてのAI改造 |
| [第2回](docs/lessons/02-frontend.md) | Reactの画面・コンポーネント・検索 |
| [第3回](docs/lessons/03-backend-database.md) | Hono API・SQLite・項目追加 |
| [第4回](docs/lessons/04-ai.md) | Responses API・プロンプト・成果共有 |
| [Codexへの指示例](docs/prompts.md) | 調査・改造・デバッグのテンプレート |
| [トラブルシューティング](docs/troubleshooting.md) | 起動・DB・API・AIの問題 |
| [設計とAPI](docs/architecture.md) | ファイルの役割、API契約、DBの説明 |
| [講師向け運営](docs/instructor.md) | 事前準備、当日のAPIキー・利用制限・終了作業 |
| [要件定義](docs/spec.md) | 講座全体の仕様 |

## ファイルの見取り図

```text
frontend/app/src/
  App.tsx            一覧・検索・絞り込み
  CardDialog.tsx     作成・編集・削除・AI結果
  api.ts             ブラウザーからAPIへの通信
  styles.css         見た目・レスポンシブ対応
api/app/src/
  server.ts          環境変数の読み込み・サーバー起動
  app.ts             HonoのAPIルート・入力チェック
  database.ts        SQLiteの初期化・読み書き
  ai.ts              Responses API・モック・プロンプト
  app.test.ts        通信・課金なしの自動テスト
shared/board.ts      共通の型・カテゴリ・ステータス
docs/               教材
.env.example        設定のひな形（秘密情報なし）
.local/             自動作成するDB（Git管理対象外）
```

## 実際のAIを使う（第4回）

`.env` を編集し、講師から受け取ったキーと指定モデルを設定します。

```dotenv
AI_MODE=openai
OPENAI_API_KEY=ここに講師から受け取ったキーを入力
OPENAI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=20
AI_MAX_OUTPUT_TOKENS=800
```

`Ctrl+C` で停止してから `npm run dev` で再起動します。キーはバックエンドだけで読み込み、フロントエンドに渡しません。`AI_MODE=disabled` でAIを無効にできます。

モデルは設定例です。講師が当日のプロジェクトで使えるモデルを事前確認してください。実装は[公式のテキスト生成ガイド](https://developers.openai.com/api/docs/guides/text)に沿って `responses.create` と `output_text` を使います。

実APIの試行回数はSQLiteに保存し、UTC日付ごとにリセットします。初期値は1台のDBあたり20回／日、出力上限800トークン、30秒タイムアウト、自動再試行なし。失敗も試行回数に含みます。この回数制限はアプリ内の補助で、課金額全体の上限ではありません。講師側の設定は[運営資料](docs/instructor.md)を参照してください。

## Dockerを使う（任意）

通常の講義ではnpmによる直接起動を使います。Docker Desktop等がある場合は次でも起動できます。

```sh
npm run setup:local
docker compose --env-file .env.compose run --rm install
docker compose --env-file .env.compose up
```

アクセス先は同じ http://127.0.0.1:5173 です。`.env.compose` はホストのUID/GIDだけを記録し、`.env` はAPIが読み込みます。Linuxでは必ずセットアップ後の `--env-file` を指定してください。停止は `Ctrl+C`、片付けは `docker compose down`。DBはホストの `.local/` に残ります。Dockerだけで環境構築する場合の手順は[環境構築資料](docs/setup.md)を参照してください。

Composeは仕様書に合わせてフロントエンドとAPIに整理しています。元のComposeにあったCognito・DynamoDB・セキュリティ監査ワーカーは、このSQLiteアプリでは使用しません。

## 検証とビルド

```sh
npm run typecheck
npm test
npm run build
# 上記の型チェック・ビルド・テストをまとめて実行
npm run check
```

自動テストは一時DBと偽のAI応答を使い、実際のキーや外部APIを使いません。GitHub Actionsでも `npm ci` → `npm run check` とComposeの構文検証を実行します。

ビルド後は `npm start` で http://127.0.0.1:3000 から画面とAPIをまとめて配信できます。バックエンドのTypeScriptはNode.js 24の標準機能で直接実行するため、追加ビルドは不要です。

このアプリは自分のPCで使う講義教材です。サーバーはループバックに限定し、認証・デプロイは講義の範囲に含めません。APIキーを含む `.env` と個人データを含む `.local/` をGitHubに追加しないでください。

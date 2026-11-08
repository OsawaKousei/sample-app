# AI TODOプランナー

やりたいことをAIと一緒にTODOに分け、テーマや優先度で整理する、初心者向けの学習用Webアプリです。全4回・各120分の講座で、起動、画面の改造、APIの追加、オリジナルアプリの開発を体験します。

## できること

- TODOを手動で登録・編集・削除する。
- やりたいことを入力し、AIが内容を要約したテーマを1つ作り、生成したTODOをそのテーマにまとめて追加する。
- テーマ別・優先度別にTODOを表示する。テーマ別は最初は折りたたまれ、見出しを押すとTODOを展開する。
- ステータスを「未着手・進行中・完了」に変更し、絞り込む。
- SQLiteに保存し、再起動後も使う。

React + Vite + TypeScript / Hono + Node.js 24 / SQLite / OpenAI Responses APIを使います。画面・APIとも日本語です。

## 起動方法（Windows / macOS共通）

必要なものは **Node.js 24.13以降の24系**、npm、Gitです。Node.jsにはnpmが付属します。Docker・Python・DBサーバーの準備は不要です。

リポジトリを取得し、ルートへ移動します。URLは講師の案内に置き換えてください。

```sh
git clone https://github.com/YOUR_NAME/ai-idea-board.git
cd ai-idea-board
```

`.env.example` をコピーして `.env` を作ります。以下のコマンドはWindowsとmacOSで共通です。既に `.env` がある場合はコピーせず、その設定を使ってください。

```sh
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
```

初回はキーが空欄のままでも構いません。次の2コマンドで画面とAPIが起動します。

```sh
npm install
npm run dev
```

**http://127.0.0.1:5173** をブラウザーで開きます。停止はターミナルで `Ctrl+C`。DBは `.local/idea-board.sqlite` に自動作成します。

WindowsのPowerShellで `npm.ps1` がブロックされた場合は、`npm` を `npm.cmd` に置き換えるか、VS Codeのターミナルをコマンドプロンプトに切り替えてください。

## AIを接続する

ルートの `.env` をエディターで開き、APIキーと講師指定のモデルを設定します。

```dotenv
OPENAI_API_KEY=ここに自分のAPIキーを設定
OPENAI_MODEL=gpt-4.1-mini
```

変更後は開発サーバーを再起動します。

- キーが空欄：外部通信なしのサンプルTODOを生成します。
- キーが設定済み：OpenAI APIを呼び出します。失敗したら画面にエラーを表示します。

キーはバックエンドだけが読み込みます。`.env` をGitHubへアップロードしたり、画面共有・チャットに貼り付けたりしないでください。予算・利用回数の管理はプラットフォーム側で行います。

## まず試す操作

1. 「＋ TODOを追加」からタイトル・テーマ・優先度を入力して保存する。
2. カードの「編集」から説明を変え、ステータスを進行中にする。
3. 「AIとTODOをつくる」にやりたいことを入力して生成する。
4. 「テーマ別」「優先度別」とステータスの絞り込みを試す。
5. ページを再読み込みし、TODOが残ることを確認する。
6. 不要なTODOを削除する。

## コードの入口

```text
frontend/app/src/
  App.tsx          画面全体・TODO一覧・状態管理
  TodoForm.tsx     TODOの追加・編集フォーム
  TodoCard.tsx     TODOカード・ステータス選択
  AiPlanner.tsx    AIへの入力フォーム
  api.ts           APIとのHTTP通信
  styles.css       見た目
api/app/src/
  app.ts           HonoのAPI
  database.ts      SQLiteの読み書き
  ai.ts            AIへの指示とResponses API
  server.ts        .env読み込みとサーバー起動
  app.test.ts      外部通信をしない自動テスト
shared/board.ts    共通の型・選択肢・表示名
```

まず `App.tsx` → `api.ts` → `app.ts` → `database.ts` の順に読むと、画面と保存のつながりを追えます。

## 確認コマンド

```sh
npm run check
```

型チェック、画面ビルド、自動テストを実行します。テストには一時DBと偽のAI応答を使い、実APIには接続しません。個別には `npm run typecheck` / `npm test` を使えます。

ビルド済みの画面をローカルで動かす場合は、`npm run build` → `npm start` の順に実行し、http://127.0.0.1:3000 を開きます。

## 講座資料

- [講座の要件](docs/spec.md)
- [環境構築](docs/setup.md) / [設計とAPI](docs/architecture.md)
- [第1回：環境構築・Codex入門](docs/lessons/01-getting-started.md)
- [第2回：フロントエンド開発](docs/lessons/02-frontend.md)
- [第3回：バックエンド開発](docs/lessons/03-backend-database.md)
- [第4回：オリジナルアプリ開発](docs/lessons/04-original-app.md)
- [オリジナルアプリの仕様・実装計画テンプレート](docs/original-app-template.md)
- [Codexへの指示例](docs/prompts.md) / [講師向け準備](docs/instructor.md)
- [困ったとき](docs/troubleshooting.md) / [検証記録](docs/verification.md)

## データと利用範囲

旧版のDBファイル名を継続して使います。既存の `ideas`・`cards` テーブルは削除せず、`todos` テーブルを追加します。旧版の相談・カードはDB内に保持しますが、新しいTODO画面には表示しません。

講座の成果物はローカル環境で動作するアプリです。インターネット公開や本番運用は講座の対象外です。公開する場合は、認証・認可、機密情報の保護、脆弱性などの別途の検証が必要です。

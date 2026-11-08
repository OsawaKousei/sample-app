# 設計とAPI

## 全体の流れ

画面はReact、HTTPの受付はHono、保存はSQLite、TODOの提案はOpenAI Responses APIが担当します。

```text
ブラウザー → Reactのapi.ts → Honoのapp.ts → database.ts → SQLite
                                         → ai.ts → OpenAI API
```

開発中はVite（5173番）が `/api` と `/healthz` をHono（3000番）へ転送します。同じURLから呼び出せるため、CORS設定は不要です。

バックエンドのTypeScriptはNode.js 24の標準機能で直接実行します。SQLiteも標準の `node:sqlite` を使うため、DBサーバーやネイティブアドオンのビルド環境は不要です。

## ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `frontend/app/src/App.tsx` | TODOの状態、登録・更新・削除、表示の切り替え |
| `frontend/app/src/TodoForm.tsx` | 追加と編集のフォーム |
| `frontend/app/src/TodoCard.tsx` | カードとステータス選択 |
| `frontend/app/src/AiPlanner.tsx` | AIに伝える目標の入力 |
| `frontend/app/src/api.ts` | fetchによるHTTP通信 |
| `api/app/src/app.ts` | リクエストの受付、保存・AI処理の呼び出し |
| `api/app/src/database.ts` | テーブル作成、CRUD、複数件保存 |
| `api/app/src/ai.ts` | 指示文、JSON形式、サンプルと実APIの切り替え |
| `api/app/src/server.ts` | .env読み込み、サーバー起動、ビルド済み画面の配信 |
| `shared/board.ts` | 型と選択肢、表示名 |

## TODOのデータ

| 項目 | 型・内容 |
| --- | --- |
| `id` | サーバーが発行するUUID |
| `title` | タイトル。必須 |
| `description` | 詳細。空文字も可 |
| `theme` | テーマ。必須、自由な文字列 |
| `priority` | `high`（高）/ `medium`（中）/ `low`（低） |
| `status` | `todo`（未着手）/ `doing`（進行中）/ `done`（完了） |
| `createdAt` | 作成日時。ISO形式 |

TODOの作り方が手動かAIかにかかわらず、同じテーブルと操作を使います。AIの元の入力や会話履歴は保存しません。

## API

| メソッド | パス | 結果 |
| --- | --- | --- |
| GET | `/healthz` | 200 `{ "status": "ok" }` |
| GET | `/api/todos` | 200 `{ "todos": [...] }`、作成の新しい順 |
| POST | `/api/todos` | 201 `{ "todo": {...} }` |
| PUT | `/api/todos/:id` | 200 `{ "todo": {...} }` |
| DELETE | `/api/todos/:id` | 204、本文なし |
| POST | `/api/todos/generate` | 201 `{ "todos": [...], "mode": "openai" または "mock" }` |

登録・更新では以下の本文を送ります。PUTは項目全体の更新です。ステータスだけを変える場合も、現在の項目と新しいステータスをまとめて送ります。

```json
{
  "title": "読みたい本を選ぶ",
  "description": "図書館で気になる本を探す",
  "theme": "学習",
  "priority": "high",
  "status": "todo"
}
```

AI生成の本文：

```json
{ "goal": "来月から自炊を始めたい" }
```

生成結果はすべて未着手として一度に保存します。SQLiteのトランザクションで、途中の保存に失敗した場合は全件取り消します。

必須項目・選択肢・JSONの形式の不備は400、対象のTODOがない場合は404、AI失敗は502、DB処理の失敗は500です。エラー本文は `{ "error": "日本語の案内" }`。APIキーや内部例外の内容は返しません。文字数、利用回数、生成件数、出力トークン数の独自上限は設けません。

## AIの扱い

ルートの `.env` は `server.ts` がNode.js標準の `loadEnvFile` で読みます。Viteは `.env` を読み込みません。`OPENAI_API_KEY` が空なら外部通信なしのサンプル、設定済みなら実APIです。失敗時のサンプル代用や自動再試行は行いません。

Responses APIの `instructions` に、入力全体を要約するテーマを1つ作り、行動をTODOへ分ける指示を渡します。`input` は目標です。`text.format` のJSON Schemaで、共通の `theme` と、タイトル・説明・優先度を持つ `todos` 配列を指定します。TODOごとのサブテーマは生成しません。受け取った共通テーマを全TODOへ設定して保存します。サンプルでは、入力の冒頭30文字を共通テーマとして使います。

例えば「機械学習に入門してMNISTを解くNNを実装したい」という入力には、「MNISTで学ぶニューラルネットワーク」のようなテーマを作り、準備から実装までのTODOをまとめます。既存TODOのテーマはそのまま保持します。

`store: false` はOpenAI側のレスポンス保存に関する指定で、SQLiteへの保存とは別です。実装形式は [OpenAI公式のStructured Outputsガイド](https://developers.openai.com/api/docs/guides/structured-outputs) を参照しています。

## 保存と表示

既定の保存先はルートの `.local/idea-board.sqlite` です。既存ファイル内に `todos` テーブルだけを追加し、旧版の `ideas`・`cards` はそのまま残します。旧データをTODOへ自動変換したり削除したりしません。今後列を追加する場合は `ALTER TABLE` で既存データを保持します。

テーマ・優先度でのグループ化とステータスの絞り込みは、取得済みの一覧に対して `App.tsx` で行います。第3回では「重要なTODOだけをDBから取得するAPI」を新しく追加し、画面側の絞り込みとAPI側の絞り込みの違いを学びます。

## 開発・確認

ルートのnpm workspacesで画面とAPIを管理し、`concurrently` で同時起動します。npmスクリプトにOS固有の環境変数設定やシェルコマンドは使いません。ファイルパスは `fileURLToPath` と `resolve` で扱います。

`npm run check` は型チェック・画面ビルド・自動テストです。テストはHonoの `app.request()`、一時SQLite、SDKへの偽fetchを使います。実キー・実APIは使いません。`npm run build` 後は `npm start` でビルド済み画面も3000番から配信します。

通常の設定はAPIキーとモデルだけです。保存先を変える場合はAPI側の `DATABASE_PATH`（ルート基準）、APIの単独確認では `PORT` も使えます。通常の開発では3000番を使ってください。

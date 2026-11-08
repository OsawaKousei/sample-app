# 第3回：バックエンド開発（120分）

テーマ：Webアプリに新しい機能を追加してみよう。

ゴール：バックエンド・HTTP・API・SQLite・CRUDの仕組みを理解し、重要なTODOだけを取得・表示する機能を追加します。

## 時間配分

| 内容 | 時間 |
| --- | ---: |
| バックエンド・APIの仕組み | 25分 |
| SQLite・データの流れ | 20分 |
| OpenAI API連携の仕組み | 15分 |
| Codexによる機能追加 | 35分 |
| 自由改造・まとめ | 25分 |
| 合計 | 120分 |

## データの流れを追う

ブラウザーの開発者ツールでNetworkを開き、TODOを登録・編集・削除します。

- GET `/api/todos`：取得（Read）。
- POST `/api/todos`：登録（Create）。
- PUT `/api/todos/:id`：更新（Update）。
- DELETE `/api/todos/:id`：削除（Delete）。

`api.ts` → `app.ts` → `database.ts` の順に読み、リクエスト本文とSQLの引数がどう対応するかを探します。再起動後もSQLiteにデータが残ることを確認します。

## OpenAI APIの仕組み

`ai.ts` の `instructions`（指示）、`input`（目標）、`text.format`（JSONの形式）、`response.output_text`（結果）を読みます。Reactから直接OpenAI APIを呼ばず、バックエンドが `.env` のキーを使います。

AIが返すタイトル・説明・テーマ・優先度を未着手のTODOとして保存しています。キーがなければサンプルを使い、実APIの失敗時はエラーを返します。アプリ側の保存とOpenAI側の `store: false` は別の設定です。形式の参考は [OpenAI公式ガイド](https://developers.openai.com/api/docs/guides/structured-outputs) を参照してください。

## 共通課題：重要なTODOだけを取得・表示する

仕様を整理します。「重要」は `priority === 'high'` とし、完了済みも含めます。既存の優先度別表示は、取得済み一覧をReactで分けています。今回はDBから条件に合うTODOだけを取得します。

1. Codexに実装方法を検討させる。
2. `database.ts` に `WHERE priority = 'high'` の取得処理を追加する。
3. Honoへ GET `/api/todos/important` を追加する。
4. `api.ts` に新しいAPIを呼び出す関数を追加する。
5. Reactに「重要なTODO」表示と全件に戻す操作を追加する。
6. 登録・優先度変更・削除後も表示が更新されることを確認する。

```text
重要なTODOだけを取得・表示する機能を追加してください。
priorityがhighのものをSQLiteから新しい順に取得し、
GET /api/todos/importantで返してください。完了済みも含めます。
ReactからこのAPIを呼び出し、全件表示にも戻せるようにしてください。
登録・編集・削除後も選択中の表示が正しく更新されるようにしてください。
既存データは消さず、一時DBのテストとnpm run checkで確認してください。
```

## 自由改造と確認

「未完了だけを取得」「特定のテーマだけを取得」などから一つ選びます。SQLの条件、API、画面を対応付けて考えます。

スキーマを変更する場合は、サーバー停止後に `.local/` をコピーしてバックアップし、`ALTER TABLE` で移行します。DB削除で済ませないようにしてください。

重要・通常のTODOを作り分けて表示を確認します。優先度を変えたとき、削除したとき、再読み込みしたときも確かめ、`npm run check` とGitへの記録を行います。

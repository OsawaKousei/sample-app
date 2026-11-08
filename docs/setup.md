# 環境構築（Windows / macOS）

## 1. 必要なものを用意する

- VS Code
- Node.js 24.13以降の24系（npmも同時に入ります）
- GitとGitHubアカウント
- 講師の案内するCodexの利用環境

Node.jsとGitはOSへ直接インストールします。Docker・WSL・Python・C++ビルドツール・DBサーバーは不要です。インストール後はVS Codeを開き直し、ターミナルで確認します。

```sh
node --version
npm --version
git --version
```

Node.jsは `v24.` で始まることを確認します。WindowsではVS CodeのターミナルにPowerShellまたはコマンドプロンプト、macOSでは標準のzshを使えます。PowerShellで `npm.ps1` の実行が止められたら、`npm.cmd --version` のように呼び出すかコマンドプロンプトへ切り替えます。

## 2. リポジトリを取得する

講師が指定するURLを使います。同期ソフトの対象外の、自分で書き込めるフォルダーを選んでください。

```sh
git clone https://github.com/YOUR_NAME/ai-idea-board.git
cd ai-idea-board
code .
```

`code` コマンドがない場合は、VS Codeの「フォルダーを開く」から取得したフォルダーを選びます。以降のコマンドはルートの `package.json` がある場所で実行します。

## 3. .envを作る

VS Codeで `.env.example` をコピーし、ファイル名を `.env` にします。または次の共通コマンドを使います。既存の `.env` がある場合は上書きしないでください。

```sh
node -e "require('node:fs').copyFileSync('.env.example', '.env')"
```

最初は `OPENAI_API_KEY` を空欄にして起動できます。実APIを使う場合はエディターでキーとモデルを設定し、サーバーを再起動します。キーを画面共有したりGitに追加したりしないでください。

## 4. インストールして起動する

```sh
npm install
npm run dev
```

http://127.0.0.1:5173 を開きます。ターミナルは起動したままにしておきます。APIは3000番、画面は5173番で動き、DBは自動作成されます。止めるときは `Ctrl+C`。

## 5. 動作を確かめる

1. TODOを手動追加する。
2. 説明を編集し、未着手から進行中・完了に変える。
3. AIにやりたいことを入力してTODOを生成する。
4. テーマ別・優先度別に切り替え、ステータスで絞り込む。
5. 再読み込み後もTODOが残ることを確認する。
6. 不要なTODOを削除する。

別のターミナルから `npm run check` を実行します。自動テストは一時DBと偽のAI応答を使うため、自分のTODOやAPIの利用料金に影響しません。

困ったときは [トラブルシューティング](troubleshooting.md) を見てください。

# 環境構築マニュアル

対象：Windows 11 / macOS。通常はDockerなしで進めます。作業フォルダはOneDrive等の同期フォルダを避け、空白の少ないパスにします。

## 1. ツールを準備する

1. [VS Code](https://code.visualstudio.com/) をインストール。
2. [Node.js](https://nodejs.org/) の **24系（24.13以降）** をインストール。npmも同梱されます。バージョン管理ツールを使用中なら、リポジトリの `.nvmrc` / `.node-version` を利用できます。
3. [Git](https://git-scm.com/downloads) をインストール。macOSで開発ツールのインストールを求められた場合は案内に従います。
4. [GitHub](https://github.com/) アカウントを用意。
5. VS Codeの拡張機能画面からOpenAI提供のCodexを導入し、講師指定のアカウント・利用方法でサインイン。アカウントの利用可否は講師と事前確認します。[Codex公式ドキュメント](https://developers.openai.com/codex/)も参照してください。

WindowsはPowerShell、macOSはターミナルを一度閉じて開き直し、次を確認します。

```sh
node --version
npm --version
git --version
```

`node` が `v24.13.0` 以上の24系なら準備完了です。Windowsで `npm.ps1` の実行を制限される場合は、以下のコマンドの `npm` を `npm.cmd` に置き換えるか、VS Codeのターミナルをコマンドプロンプトに変更します。

## 2. リポジトリを取得する

GitHub上で講師のリポジトリをFork（テンプレートの場合は「Use this template」）し、自分のリポジトリURLをコピーします。

### Windows（PowerShell）

```powershell
New-Item -ItemType Directory -Force "$HOME\workshop"
Set-Location "$HOME\workshop"
# 次のURLは自分のリポジトリURLに置き換える
git clone https://github.com/YOUR_NAME/ai-idea-board.git
Set-Location ai-idea-board
code .
```

### macOS

```sh
mkdir -p ~/workshop
cd ~/workshop
# 次のURLは自分のリポジトリURLに置き換える
git clone https://github.com/YOUR_NAME/ai-idea-board.git
cd ai-idea-board
code .
```

`code` が見つからなければ、VS Codeの「フォルダーを開く」で取得したフォルダを選びます。

## 3. 起動する

VS Codeの「ターミナル → 新しいターミナル」で、`package.json` のあるルートから実行します。

```sh
npm install
npm run setup:local
npm run dev
```

http://127.0.0.1:5173 を開きます。ターミナルには `api` と `web` のログが出ます。終了は `Ctrl+C`。第1〜3回ではAPIキーを入力する必要はありません。

確認：6枚のカードが見える → 新しいカードを作る → 再読み込みして残る → 編集・削除する → カードを開いて練習用AI応答を表示する。

## 4. Gitに改造を記録する

名前とメールは自分のもの、またはGitHubの非公開メールに置き換えます。

```sh
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
git status
git add frontend/app/src/App.tsx
git commit -m "Change board heading"
git push
```

最初の `push` で認証が必要なら、GitHubまたはGit Credential Managerのブラウザー案内に従います。`git diff` で変更を確認してから、変更したファイルだけを追加する練習をします。`.env` と `.local/` は無視されます。

## 5. Dockerで起動する場合（任意）

Docker Desktop / Docker EngineとComposeプラグインが必要です。WindowsはDocker DesktopのLinuxコンテナを使用します。Node.jsもある場合：

```sh
npm run setup:local
docker compose --env-file .env.compose run --rm install
docker compose --env-file .env.compose up
```

Node.jsをホストに入れずに試す場合は、`.env.example` を `.env` にコピーしてから実行します。

```sh
# macOS: cp .env.example .env
# PowerShell: Copy-Item .env.example .env
docker compose run --rm install
docker compose up
```

LinuxでNode.jsを使わない場合は `.env.compose` に `LOCAL_UID` と `LOCAL_GID` を自分の `id -u` / `id -g` の値で作成し、全コマンドに `--env-file .env.compose` を付けます。macOS/Windowsでは通常1000の既定値で利用できます。

Composeでも http://127.0.0.1:5173 を開きます。APIは内部で `0.0.0.0` にバインドし、ホスト公開は `127.0.0.1` に限定します。npm直接起動とComposeを同時に起動しないでください。

依存更新後はinstallを再実行します。`.env` の変更後は `docker compose restart api`。ホストとコンテナを切り替えてネイティブ依存のエラーが出た場合は停止してから、使用する環境で `npm ci` を実行します。

## 困ったとき

[トラブルシューティング](troubleshooting.md)を参照し、OS・Node.jsバージョン・実行コマンド・秘密情報を除いたエラー本文を講師に伝えてください。

<p align="center">
<img src="https://github.com/akashic-games/akashic-system/blob/main/img/akashic.png"/>
</p>

# akashic-system

Akashic のサーバーサイドとなる、Akashic System のメインリポジトリです。Akashic System の詳細な利用方法については、[公式サイトのドキュメント](https://akashic-games.github.io/akashic-system/) を参照してください。

## `packages/` と `servers/` ディレクトリ

[`packages/`](./packages) ディレクトリには、 `npm install` して使われるライブラリが置かれています。

[`servers/`](./servers) ディレクトリには、 `npm start` ができる `private:true` なものが置かれています。

# 開発するにあたり

## 開発環境

インストールして一通り動かすのに必要なもの

- [Node.js LTS](https://nodejs.org/)
- [Yarn Classic](https://classic.yarnpkg.com/lang/en/)
- [node-gyp setup](https://github.com/nodejs/node-gyp#installation)
- [Docker](https://www.docker.com/): for middlewares

CLI によるインストール

```bash
git clone git@github.com:akashic-games/akashic-system.git
cd akashic-system

yarn install --immutable --check-cache
yarn build

git config commit.template .gitcommit.txt

docker-compose up -d

yarn db:migrate
yarn db:seed
```

[http://localhost:17000](http://localhost:17000) を開く

### ホスト OS の hosts に追加するもの（推奨設定）

```
127.0.0.1 database
127.0.0.1 redis
127.0.0.1 rabbitmq
127.0.0.1 mongodb
127.0.0.1 zookeeper
127.0.0.1 minio
```

## コミットメッセージ

すべて [Conventional Commits](https://www.conventionalcommits.org/) にしてください。

`$ git config commit.template .gitcommit.txt` でコミットメッセージのテンプレートを設定すると良いでしょう。

## npm script

開発手順は、 npm のライフサイクルに則っています。
https://docs.npmjs.com/misc/scripts

リポジトリのルートで実行するもの

| 実行の仕方          | 説明                                                                             |
| :------------------ | :------------------------------------------------------------------------------- |
| `npm run bootstrap` | このリポジトリの初期化をする。                                                   |
| `npm start`         | すべての Akashic サーバを起動する。Docker で各種ミドルウェアも起動しておくこと。 |
| `npm t`             | すべてのテストを実行する。                                                       |
| `npm run fmt`       | コードの整形をする。                                                             |
| `npm run lint`      | （CI でしか使わない）すべての Lint を実行する。（ `npm run fmt` で良い）         |
| `npm run push`      | 更新のあるモジュールのバージョンを更新して `npm publish`                         |

各パッケージで実装されている必要のあるもの

| `npm run xxx` の `xxx` | 説明                                   |
| :--------------------- | :------------------------------------- |
| `prepare`              | https://docs.npmjs.com/misc/scripts    |
| `lint`                 | なにか特別な Lint があれば。           |
| `format`               | なにか特別な code formatter があれば。 |

## テスト

### テストの実行

- リポジトリルートで `npm run ci-test` ： Small と Medium
- リポジトリルートで `npm t` ： 全部（Small と Medium と Large と Enormous）
- 各パッケージで `npm t` ： そのパッケージの Small と Medium と Large

### テストの実装を書く場所、テストファイルの命名規則

`*.spec.ts` は、 Small テストです。テスト対象のクラスが使う Dependencies はすべて Mock にしてください。

`*.test.ts` は、Medium テストです。同じ名前空間以下の Dependencies と外部モジュールは適宜 `import` し、生成して使えます。

`__tests__/` ディレクトリにあるものは、 Large テストです。テストファイルからは `../index.ts` と外部モジュールのみ `import` してよいです。
例えば `Play/__tests__/basic.ts` というファイルからは、「 `Play/index.ts` 」と、「必要な外部モジュール」のみが使えます。

例外として、 `./src/infrastructure/` は外部モジュール扱いして良いです。

リポジトリルートの `tests/` ディレクトリには、 Enormous テストがあります。
これは、 servers を使う、いわゆる「シナリオテスト」「E2E テスト」を実装する場所です。

例えば [MinIO](https://min.io/) や [Grafana](https://grafana.com/)などを docker-compose.middleware.yml に含めておいて利用するなら、ミドルウェア扱いして良いです。

ただし、「 `servers/` にあるものを `docker run` して http アクセスする」みたいなのは、「外部サービスの利用」に当たるものとし、 Enormous になります。

### CI

Pull Request の作成・更新を契機に CI が起動します。Approve を得る前に CI が通るかどうかを確認してください。
また、main ブランチへの push によっても CI は起動します。

CI では全てのテストと lint チェック、コーディング・フォーマットのチェックがおこなわれます。

CI のワークフローは次のファイルで管理しています:
[.github/workflows/ci.yml](.github/workflows/ci.yml)

## リリースについて

### npm package

他のプロジェクトから参照される以下の package が publish 対象です。main ブランチに push することで、ワークフローが自動で publish を開始します。
新しいバージョンのパッケージを公開する際は、あらかじめ各 package の package.json の `version` を書き換えておいてください。

- `packages/akashic-storage-core`
- `packages/amflow-message`
- `packages/amtplib`
- `packages/cast-util`
- `packages/content-storage-types`
- `packages/master-agent-rpc`
- `packages/playlog-client`
- `packages/server-engine-data-types`

ワークフローは次のファイルで管理しています:
[.github/workflows/release-packages.yml](.github/workflows/release-packages.yml)

### Docker image

main ブランチに push することで、ワークフローが自動で Docker image の build と push をおこないます。

次の Docker image が作られます。

- `ghcr.io/akashic-games/akashic-system:latest-amd` (amd64 版)
- `ghcr.io/akashic-games/akashic-system:latest-arm` (arm64 版)

また、上記 image を参照するマルチアーキテクチャの manifest も作られます。

- `ghcr.io/akashic-games/akashic-system:latest`

利用可能なイメージはこちらで確認できます:
https://github.com/orgs/akashic-games/packages/container/package/akashic-system

ワークフローは次のファイルで管理しています:
[.github/workflows/release-image.yml](.github/workflows/release-image.yml)

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

ただし、画像ファイルは
[CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/) の元で公開されています。

サードパーティ製のライセンスについては [THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES) をご覧ください。

# cluster-monitor-api-server

cluster-monitor の状態などを返す API サーバ

## ビルド方法

`npm run build` により gulp を使ってビルドできます。

```sh
npm install
npm run build
```

## テスト方法

1. [TSLint](https://github.com/palantir/tslint "TSLint")を使った Lint
2. [Jasmine](http://jasmine.github.io "Jasmine")を使ったテスト

がそれぞれ実行されます。

```sh
npm test
```

## 実行方法

- ポート番号を変更したい場合は `config/*.json` の `server.port` を変更してください。
- Unix Domain Socket で通信する場合は `config/*.json` の `server.unixDomainSocket` に生成先のパスを指定してください。
- サーバが listening 状態になった後に PID ファイルを生成することができます。`config/*.json` の `pidFile` に生成先のパスを指定してください。
- Docker Composes で起動する場合は `config/template.json` が使用されます。

以下のコマンドを実行することでサーバが起動します。

```sh
npm start
```

### 実行例

```sh
$ curl "http://localhost:3000/clusters/akashic/processes?_count=1"
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

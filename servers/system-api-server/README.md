# system-api-server

クライアントサービスの求めに応じてゲーム起動やゲーム情報等を返すシステム間 API サーバ

## インストールとビルド

```sh
npm install
npm run build
```

## テスト

```sh
npm test
```

1. [TSLint](https://github.com/palantir/tslint "TSLint")を使った Lint
2. [Jasmine](http://jasmine.github.io "Jasmine")を使ったテスト

## 実行方法

- ポート番号を変更したい場合は `config/*.json` の `server.port` を変更してください。
- Unix Domain Socket で通信する場合は `config/*.json` の `server.unixDomainSocket` に生成先のパスを指定してください。
- サーバが listening 状態になった後に PID ファイルを生成することができます。`config/*.json` の `pidFile` に生成先のパスを指定してください。

以下のコマンドを実行することでサーバが起動します。

```sh
npm start
```

System API を参考に、curl などを使って API にリクエストを投げてください。

## Docker Container のビルド

`npm run docker:build` してください。 `docker build .` は、前提となるタスクがあります。

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

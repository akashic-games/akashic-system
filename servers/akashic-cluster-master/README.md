# Akashic Cluster Master

Akashic Cluster の管理・統括体。  
Zookeeper で構築されたクラスタを監視し、Akashic Cluster Node となる Game Runner を制御する。

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

dev 環境のデータベースを使ってテストする際は、`config/development.json` の設定を使用してください。
dev 環境の zookeeper を使ってテストする際は、host を適切なものに変更してください。

サーバのポート番号を変更したい場合は 'server' オブジェクト下のポート番号を変更してください。

以下のコマンドを実行することでサーバが起動します。

```sh
npm start
```

インスタンス API を参考に、curl などを使ってリクエストを投げてください。

### Windows の方

2016 年 04 月現在、ローカルで `npm install` すると zookeeper がビルドできない為、インストールが正常に行えません。
以下の方法で、なんとかします。

- VM で開発
- 足元サーバーで `npm install` した node_modules をローカルに持ってくる(scp 等)

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

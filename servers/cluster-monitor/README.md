# cluster-monitor

Akashic cluster の稼働状態をモニタリングする (Akashic system の)開発者向けツール。

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

以下のコマンドを実行することでサーバが起動します。

```sh
npm run start
```

17000 ポートにブラウザでアクセスしてください。

## Tips

### ホットリロード

開発時はファイル変更されたとき自動的にビルド＆リスタートされるホットリロードを用いると便利です。

- TypeScript コンパイラの`watch`オプション `tsc -w`
- タスクを見やすく並行実行する[`concurrently`](https://www.npmjs.com/package/concurrently)
- ファイル変更を検知してコマンドを実行する[`nodemon`](https://www.npmjs.com/package/nodemon)

を利用します。

#### インストール

```sh
npm i -g concurrently nodemon
```

#### 設定例

`nodemon.json`に監視対象のパス`watch`、実行コマンド`exec`を設定します。

```sh
cat << EOS > nodemon.json
{
  "watch": ["lib"],
  "exec": "npm start"
}
EOS
```

`tsc -w`でコンパイルされた js ファイルが`lib`に生成されるので、`lib`を監視します。

#### 起動

```sh
concurrently "./node_modules/.bin/tsc -w" "nodemon"
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

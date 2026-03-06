# playlog-client

playlog-client は playlog-server と通信するための [Akashic Message Flow (AMFlow)](https://github.com/akashic-games/amflow) 実装です。

このパッケージはオープンソースの [akashic-games/engine-files](https://github.com/akashic-games/engine-files) から利用されています。Akashic システムと通信するエンジンファイルを作成する場合に Optional Dependencies として参照され、ビルド・生成することができます。

## 動作環境

- Akashic GameView の実装が動作すること
- WebSocket API が利用できる環境
  - [AMTP over WebSocket](https://github.com/akashic-games/akashic-system/blob/master/packages/amtplib/doc/amtp-v1-spec.md) を採用しています。
- ECMAScript 5
  - Promise などの利用は Polyfill が必要になります。(https://github.com/stefanpenner/es6-promise)

## 開発者向け情報

- このパッケージは [akashic-games/engine-files](https://github.com/akashic-games/engine-files) から利用されています。
  - このパッケージのバージョンを SemVer 的に正しく管理・運用をしていたとしても、破壊的変更をすると壊れるため、してはいけません。
- このモジュールは複数のバージョンのエンジンから参照されるため、互換性を保つ必要があります。
  - モジュールの提供するシグネチャを変更しないでください。
  - トランスパイラの更新や設定変更などで提供形態が変わる場合、engine-files でビルドできるか確認してください。
  - UMD のビルド・動作確認をしてください。サーバ向けのテストで成功していても、クライアント向け UMD の生成に失敗する可能性があります。

[akashic-games/engine-files](https://github.com/akashic-games/engine-files) のビルド方法:

```
$ npm i
$ npm --save-optional @akashic/playlog-client@6.0.8 # 更新対象が 6.0.8 の例
$ npm run build
$ ls dist/raw/*/playlogClient*
dist/raw/canvas/playlogClientV6_0_8.js  dist/raw/full/playlogClientV6_0_8.js
```

### 安定版を維持しつつ試験版をリリースする方法

1. package.json のバージョンを[プレリリースバージョン](https://semver.org/lang/ja/#spec-item-9)にしてください。
1. --tags= を latest 以外にして publish します。

```sh
# akashic@playlog-client@1.0.0-beta.1 を beta としてリリース:
private-npm-publish --tags=beta
```

[private-npm-publish](https://github.com/dwango-js/private-npm-publish) は private module を publish するツールです。

## 利用方法

```
var PlaylogClient = require("akashic/playlog-client");
var client = new PlaylogClient.Client({url: PlaylogServerUrl});
client.open("playId", function(err) {
  ...
});
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

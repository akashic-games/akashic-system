# master-agent-rpc

masterとagent間のthrift-RPC用のプロトコル

## インストール

```sh
$ npm install @akashic/master-agent-rpc
```

## src/thrift/ への出力方法

thrift/cluster.thrift を編集した場合、 src/thrift/ に変更内容を反映する必要があります。
以下の手順で行います。

Docker を利用して、下記セットアップ手順を行うことなくビルドを行います。

```sh
docker build -t thrift-generator .
docker run --rm -it -v ./src/thrift:/home/master-agent-rpc/output thrift-generator
```

一般的に配布されている thrift ではなく、 type script での出力ができるようにカスタマイズしたもの (ext_libs/thrift) を使います。
`docker build` でカスタマイズ版 thrift がインストールされた docker image を作成し、
`docker run` で出力を行います。

出力されたファイルはコミットに含めてください。

## ビルド方法

`npm run build` によりgulpを使ってビルドできます。

```
npm install
npm run build
```

[thrift-install]: http://thrift.apache.org/docs/install/

## 使い方

### client

```typescript
import thrift = require("thrift");
import RPC = require("@akashic/master-agent-rpc");
var connection = thrift.createConnection(host, port, {});
connection.once("connect", () => {
  var client = thrift.createClient(RPC.Agent, connection);
  client.instanceAssign(instanceTask);
});
```

### server

```typescript
import thrift = require("thrift");
import RPC = require("@akashic/master-agent-rpc");

class Handler implements RPC.Master.MasterLike {
  // implement it!
}

var handler = new Handler();
this.server = thrift.createServer(RPC.Master, handler, {});
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

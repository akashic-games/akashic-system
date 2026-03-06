# instance-requester

master にインスタンスの操作を要求するライブラリ

現状は、インスタンス起動/停止のみ。

## 使い方

### リクエストする (publish する) 側

```typescript
import {AmqpConnectionManager} from "@akashic/amqp-utils";
import {InstanceRequestPublisher} from "@akashic/instance-requester";

async function usage(): Promise<void> {
  // @akashic/amqp-utils の AmqpConnectionManager を利用して、RabbitMQ に接続
  const mgr = new AmqpConnectionManager({...});
  await mgr.init();

  const publisher = new InstanceRequestPublisher(mgr);
  // リクエスト用の exchange/queue をセットアップ
  await publisher.setup();

  // インスタンス ID を指定してインスタンス起動を要求
  await publisher.requestStartInstance("42");

  // ...

  // インスタンス ID を指定してインスタンス停止を要求
  await publisher.requestStopInstance("42");
}
```

### リクエストを受け付ける (consume する) 側

```typescript
import {AmqpConnectionManager} from "@akashic/amqp-utils";
import {
  InstanceRequestMessageType,
  InstanceRequestMessage,
  InstanceRequestConsumer
} from "@akashic/instance-requester";

// リクエストのハンドラ
async function onRequest(request: InstanceRequestMessage<any>): Promise<boolean> {
  if (request.type === InstanceRequestMessageType.Start) {
    // 起動処理
  } else if (request.type === InstanceRequestMessageType.Stop) {
    // 停止処理
  }
  return true;  // ack を要求 (nack したいときは false を返す)
}

async function usage(): Promise<void> {
  // @akashic/amqp-utils の AmqpConnectionManager を利用して、RabbitMQ に接続
  const mgr = new AmqpConnectionManager({...});
  await mgr.init();

  // リクエストのハンドラを指定して consumer を作成
  const consumer = new InstanceRequestConsumer(mgr, async (req) => { return await onRequest(req); });
  // consume が開始されると connect が emit されます
  consumer.on("connect", () => { console.log("request consumer connected"); });
  // 接続断や channel error 等で consume が停止されると close が emit されます
  // (その後、再接続されて consume が再開さると connect が emit されます)
  consumer.on("close", () => { console.log("request consumer disconnected"); });
  // パースできないメッセージなどを受信した場合は、unhandledMessage が emit されます
  // (これを引き起こしたメッセージは ack が返され、 consumer 内で捨てられます)
  consumer.on("unhandledMessage", (cause) => { console.warn("message unhandled, cause: ", cause)});

  // consume 開始
  await consumer.start();

  // ...

  // consume 停止
  await consumer.stop();
}
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

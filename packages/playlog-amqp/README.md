# playlog-amqp

### Tick

- `Tick#publish()`、`Tick#consume()` を呼ぶ前に `Tick#assertExchange()` を呼び出してエクスチェンジを生成する必要があります。

### Event

- `Event#publish()`、`Event#consume()` を呼ぶ前に `Event#assertExchange()` と `Event#assertQueue()` を呼び出してエクスチェンジとキューを生成する必要があります。

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

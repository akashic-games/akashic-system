# API リファレンス

System API のリファレンスです。利用者の方は [はじめに](../introduction.md) をご覧ください。

## エンドポイント

実行環境によりエンドポイントとなる URL が定義されます。API リファレンスのリクエスト実行例では、`${ENDPOINT}` で表されます。

## API リファレンス

- [プレー API](./plays.md)
  - [プレートークン API](./plays_tokens.md)
  - [プレーの親子関係 API](./plays_children.md)
  - [プレーログ API](./plays_playlog.md)
  - [プレーログイベント API](plays_events.md)
- [インスタンス API](./instances.md)
- [システムの健全性チェック API](./healthcheck_status.md)

## API 仕様など

- [System API で使われるパラメータの仕様](./specification_parameters.md)
- [イベント通知の仕様](./specification_event.md)
- [プレー状態の仕様](./specification_play_status.md)
- [インスタンス状態の仕様](./specification_instance_status.md)
- [Permission フラグの仕様](./specification_permission.md)

### レスポンスフォーマット

#### 正常系

```
{ "meta":{ "status":200 }, "data":{ /\* ここに各API別のデータ \*/ } }
```

#### エラー

```
{ "meta":{ "status":400, "errorCode":"エラーコード", "errorMessage":"エラーメッセージ", "debug":"デバッグ情報" } }
```

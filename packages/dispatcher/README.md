# Dispatcher

## Overview

特定の条件でエッジサーバ・プロセスを導出し、そのエンドポイントを返す API を提供する。  
現時点で対応している機能は以下の通り。

| Dispatching    | Description                                                       |
| :------------- | :---------------------------------------------------------------- |
| Playlog Server | プロトコルなどを表す Trait とプレー ID から最適なサーバを選出する |

## Requirements

- [Zookeeper](https://zookeeper.apache.org/)
  - プロセスの死活監視に利用
- [Redis](http://redis.io/)
  - プロセス割り当て情報保存先に利用

## APIs

ROOT endpoint:`/v1.0`

### Reserve a connection resource in playlog server

`POST endpoints/:trait/plays/:playId/reservations`

#### Parameters

- Path
  - trait: "standard_websocket", or "standard_long_polling"
  - playId
- JSON
  - playToken

#### Response

- Endpoint of playlog server

#### Errors

- 400 INVALID_PARAMETER
- 403 FORBIDDEN
- 404 NOT_FOUND
- 500 INTERNAL_SERVER_ERROR
- 503 SERVICE_UNAVAILABLE

#### Usage

```
npm start -- -p 1234
# Options:
# -p [value] or --port=[value]: A number of port
```

#### Example

```
curl -v -H "Accept: application/json" -H "Content-type: application/json" -X POST -d \
  '{"playToken": "token_string"}' \
  https://api.playlog.com/v1.0/endpoints/standard_websocket/plays/1/reservations

{
  "meta":{
    "status":200
  },
  "data":{
    "endpoint": "https://mes.playlog.com"
  }
}
```

#### Integration test

```
npm start &
npm run integration-test
```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

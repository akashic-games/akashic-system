# インスタンス API

## GET v1.0/instances - インスタンス一覧取得

###

指定条件に一致するインスタンスの一覧を取得します

### URIパラメータ

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>gameCode</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"oekaki"</td>
<td>検索対象とするゲームの識別子を指定します。</td>
</tr>
<tr class="even">
<td>status</td>
<td>Array[String]</td>
<td><br />
</td>
<td><br />
</td>
<td>"running"</td>
<td><p>検索対象とするインスタンスの状態を指定します。</p>例: status[]=running</td>
</tr>
<tr class="odd">
<td>entryPoint</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td><p>"engines/0000/akashic"</p></td>
<td>検索対象とする実行ファイルパスを指定します。前方一致のみです。</td>
</tr>
<tr class="even">
<td>videoPublishUri</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"dmtpraw://dmc.example.nico/1"</td>
<td>検索対象とするビデオ出力先を指定します。前方一致のみです。</td>
</tr>
<tr class="odd">
<td>processName</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"gameRunner"</td>
<td>検索対象とするプロセス識別子を指定します。 前方一致のみです。</td>
</tr>
<tr class="even">
<td>_offset</td>
<td>Int</td>
<td><br />
</td>
<td>0</td>
<td>0</td>
<td>取得開始位置を指定します。</td>
</tr>
<tr class="odd">
<td>_limit</td>
<td>Int</td>
<td><br />
</td>
<td>10</td>
<td>100</td>
<td>取得数を指定します。 最大：100</td>
</tr>
<tr class="even">
<td>_count</td>
<td>Int</td>
<td><br />
</td>
<td>0</td>
<td>0</td>
<td>1 を指定した場合、指定条件に合致するインスタンスの総件数を取得します。</td>
</tr>
</tbody>
</table>

### リクエスト

```
curl -X GET ${ENDPOINT}/v1.0/instances?gameCode=oekaki&_limit=2
```

### レスポンス

#### data要素

| キー名     | 型                 | 概要                                                                         |
| ---------- | ------------------ | ---------------------------------------------------------------------------- |
| values     | Array\[Instances\] | [インスタンス要素](specification_parameters.md#instance)の配列が格納されます |
| totalCount | Option[Int]        | \_count を指定した場合、条件に合致するインスタンスの総件数が入ります         |

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "values": [
      {
        "id": "1",
        "gameCode": "oekaki",
        "status": "closed",
        "modules": [
          {
            "code": "dynamicPlaylogWorker",
            "values": {
              "playId": "1",
              "executionMode": "active"
            }
          },
          {
            "code": "akashicEngineParameters",
            "values": {
              "gameConfigurations": ["games/oekaki/1.0/game.json"]
            }
          }
        ],
        "region": "akashicCluster",
        "entryPoint": "engines/akashic/v1.0/entry.js",
        "cost": 1,
        "exitCode": 0,
        "processName": "game-runner-process-name"
      },
      {
        "id": "4",
        "gameCode": "oekaki",
        "status": "closed",
        "modules": [
          {
            "code": "dynamicPlaylogWorker",
            "values": {
              "playId": "18",
              "executionMode": "active"
            }
          },
          {
            "code": "eventHandlers",
            "values": {
              "handlers": [
                {
                  "type": "error",
                  "endpoint": "http://example.jp/somewhere/",
                  "protocol": "http"
                },
                {
                  "type": "instanceStatus",
                  "endpoint": "http://example.jp/somewhere/",
                  "protocol": "http"
                },
                {
                  "type": "gameEvent",
                  "endpoint": "http://example.jp/somewhere/",
                  "protocol": "http"
                }
              ]
            }
          },
          {
            "code": "akashicEngineParameters",
            "values": {
              "gameConfigurations": ["games/oekaki/1.0/game.json"]
            }
          },
          {
            "code": "videoPublisher",
            "values": {
              "videoPublishUri": "rtmp://xxx.yyy.zzz/live/integrate-active-play18",
              "videoFrameRate": 10
            }
          }
        ],
        "region": "akashicCluster",
        "entryPoint": "engines/akashic/v1.0/entry.js",
        "cost": 1,
        "exitCode": 0,
        "processName": "game-runner-process-name"
      }
    ]
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考                   |
| ---------------- | --------------------- | ---------------------- |
| 400              | INVALID_PARAMETER     | クエリパラメータが不正 |
| 500              | INTERNAL_SERVER_ERROR | システムエラー         |

## POST v1.0/instances - インスタンス作成

### 概要

インスタンスの作成を行います。事前に[プレーの作成](plays.md)を行うか、プレーログを取得している必要があります。

どのようにインスタンスを動作させるかは、モジュールの指定によります。詳細は[パラメータのモジュール](specification_parameters.md#module)を参照してください。

### ボディ

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>gameCode</td>
<td>String</td>
<td> ◯</td>
<td><br />
</td>
<td>"oekaki"</td>
<td>インスタンスで実行するゲーム識別子</td>
</tr>
<tr class="even">
<td>gameRevision</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"1.0"</td>
<td><p>インスタンスで実行するゲームのリビジョン</p>
<p>内部でのログ生成目的のためだけに使用されます。</p></td>
</tr>
<tr class="odd">
<td>entryPoint</td>
<td>String</td>
<td><br />
</td>
<td>""</td>
<td>"engines/akashic/v1.0/entry.js"</td>
<td><div class="content-wrapper">
<p>modules パラメータの <a href="specification_parameters.md#code-akashicEngineParameters">akashicEngineParameters</a> によって実行するゲームエンジンが特定できる場合は省略可能です。特に理由がない限り省略することを推奨します。</p>
<p>ゲームエンジンを起動するためのコードの場所を指定します。実行環境の起点ディレクトリからの相対パスとして解釈されます。</p>
</div></td>
</tr>
<tr class="even">
<td>cost</td>
<td>Int</td>
<td>◯ </td>
<td><br />
</td>
<td>1 </td>
<td>割当コスト </td>
</tr>
<tr class="odd">
<td>modules</td>
<td>Array[Modules] </td>
<td>◯ </td>
<td><br />
</td>
<td><br />
</td>
<td><p>のうち、必要とするモジュールの配列</p></td>
</tr>
<tr class="even">
<td>assignmentConstraints</td>
<td><div class="content-wrapper">
<p>下記形式の Object</p>
{ trait: string or string[] }
</div></td>
<td><br />
</td>
<td><br />
</td>
<td><div class="content-wrapper">
{ "trait": "sample-trait" }
</div>
<div>or</div>
<div class="content-wrapper">
{ "trait": ["sample-trait"] }
</div>
</td>
<td><p>インスタンス実行プロセス割り当て先の制約条件を指定するオプションです。</p>
<p>通常は指定する必要はありません。</p></td>
</tr>
<tr class="odd">
<td>forceAssignTo</td>
<td><div class="content-wrapper">
<p>下記形式の Object</p>
{ host: String name: String }
</div></td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><p>インスタンス実行プロセスの割り当て先を強制的に指定するオプションです。</p>
<p>デバッグ/解析用途のパラメータであるため、通常使用時には指定しないでください。</p></td>
</tr>
</tbody>
</table>

#### modules について

[パラメータ仕様のモジュール](specification_parameters.md#module)より、必要とするものをこの要素に追加していく形となります。

例えば、インスタンスのイベント通知が必要なのであれば [eventHandlers](specification_parameters.md#code-eventHandlers) を追加します。

[dynamicPlaylogWorker](specification_parameters.md#code-dynamicplaylogworker) と [staticPlaylogWorker](specification_parameters.md#code-staticplaylogworker) は対になる存在で、両方を記載した場合 staticPlaylogWorker を優先して利用するようになっています。

#### akashic コンテンツを実行する場合

以下のパラメータは modules に必須となります。

- [dynamicPlaylogWorker](specification_parameters.md#code-dynamicplaylogworker) または [staticPlaylogWorker](specification_parameters.md#code-staticplaylogworker) のいずれか
- akashicEngineParameters

また、ゲームコンテンツ側に実行環境の情報が設定されている場合、entryPoint パラメータを指定する必要はありません。詳細は [akashicEngineParameters](specification_parameters.md#code-akashicengineparameters) を参照してください)。

### リクエスト

```sh
curl -X POST ${ENDPOINT}/v1.0/instances -d '{"gameCode":"oekaki","cost":1,"entryPoint":"/akashic/v1.0/entry.js","modules":[{"code":"dynamicPlaylogWorker","values":{"playId":"1","executionMode":"active"}},{"code":"akashicEngineParameters","values":{"gameConfigurations":["games/oekaki/1.0/game.json"]}}]}' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

作成された[インスタンス要素](specification_parameters.md#instance) を data に入れて返します。

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "id": "24",
    "gameCode": "final_final",
    "status": "prepare",
    "modules": [
      {
        "code": "dynamicPlaylogWorker",
        "values": {
          "playId": "1",
          "executionMode": "active"
        }
      }
    ],
    "region": "akashicCluster",
    "entryPoint": "/akashic/v1.0/entry.js",
    "cost": 1,
    "exitCode": null
  }
}
```

## GET v1.0/instances/:id - インスタンス取得

### 概要

指定したIDのインスタンスを取得します

### URIパラメータ

<table class="wrapped" style="width:100%;">
<colgroup>
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
<col style="width: 16%" />
</colgroup>
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td> ◯</td>
<td><br />
</td>
<td>1</td>
<td>取得するインスタンスのID</td>
</tr>
</tbody>
</table>

### リクエスト

```
curl -X GET ${ENDPOINT}/v1.0/instances/42
```

### レスポンス

#### data要素

取得した[インスタンス要素](specification_parameters.md#instance) を data に入れて返します。

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "id": "24",
    "gameCode": "final_final",
    "status": "prepare",
    "modules": [
      {
        "code": "dynamicPlaylogWorker",
        "values": {
          "playId": "1",
          "executionMode": "active"
        }
      }
    ],
    "region": "akashicCluster",
    "entryPoint": "/akashic/v1.0/entry.js",
    "cost": 1,
    "exitCode": null
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考                     |
| ---------------- | --------------------- | ------------------------ |
| 400              | INVALID_PARAMETER     | インスタンスIDが不正     |
| 404              | NOT_FOUND             | インスタンスが存在しない |
| 500              | INTERNAL_SERVER_ERROR | システムエラー           |

## DELETE v1.0/instances/:id - インスタンス終了

### 概要

指定したIDのインスタンスを終了させます

### URIパラメータ

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td> ◯</td>
<td><br />
</td>
<td>1</td>
<td>終了するインスタンスのID</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X DELETE ${ENDPOINT}/v1.0/instances/53
```

### レスポンス

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考                                                                                        |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| 400              | INVALID_PARAMETER     | インスタンスIDが不正                                                                        |
| 404              | NOT_FOUND             | インスタンスが存在しない                                                                    |
| 409              | CONFLICT              | 指定したインスタンスが終了できない状態（status: prepare, running 以外の時に終了させた場合） |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                                                                              |

## PATCH v1.0/instances/:id -インスタンス一時停止/復帰

### 概要

指定したIDのインスタンスを一時停止および復帰を行います。

### URIパラメータ

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td> ◯</td>
<td><br />
</td>
<td>1</td>
<td>実行一時停止 or 復帰させるインスタンスの ID</td>
</tr>
</tbody>
</table>

### ボディ

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー</th>
<th>型</th>
<th>必須</th>
<th>デフォルト</th>
<th>サンプル</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>status</td>
<td>String</td>
<td> ◯</td>
<td><br />
</td>
<td><p>"paused"</p>
<p>"running"</p></td>
<td><p>インスタンスを一時停止させたい場合は、"paused" を指定する。</p>
<p>一時停止から復帰させたい場合は、"running" を指定する。</p></td>
</tr>
</tbody>
</table>

### リクエスト

一時停止の例

```sh
curl -X PATCH -H "Content-type: application/json" -d '{"status":"paused"}' ${ENDPOINT}/v1.0/instances/42
```

復帰の例

```sh
curl -X PATCH -H "Content-type: application/json" -d '{"status":"running"}' ${ENDPOINT}/v1.0/instances/42
```

### レスポンス

#### data要素

更新した[インスタンス要素](specification_parameters.md#instance)を data に入れて返します。

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "id": "24",
    "gameCode": "final_final",
    "status": "pausing",
    "modules": [
      {
        "code": "dynamicPlaylogWorker",
        "values": {
          "playId": "1",
          "executionMode": "active"
        }
      }
    ],
    "region": "akashicCluster",
    "entryPoint": "/akashic/v1.0/entry.js",
    "cost": 1,
    "exitCode": null
  }
}
```

#### 失敗

<table class="wrapped">
<tbody>
<tr class="header">
<th>ステータスコード</th>
<th>エラーコード</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>400</td>
<td>INVALID_PARAMETER</td>
<td>インスタンスIDが不正</td>
</tr>
<tr class="even">
<td>404</td>
<td>NOT_FOUND</td>
<td>インスタンスが存在しない</td>
</tr>
<tr class="odd">
<td>409</td>
<td>CONFLICT</td>
<td><p>一時停止時: 稼働中(running)以外の状態のインスタンスに一時停止がリクエストされた</p>
<p>復帰時: 一時停止中(paused)以外の状態のインスタンスに復帰がリクエストされた</p></td>
</tr>
<tr class="even">
<td>500</td>
<td>INTERNAL_SERVER_ERROR</td>
<td>システムエラー</td>
</tr>
</tbody>
</table>

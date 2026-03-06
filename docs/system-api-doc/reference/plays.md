# プレー API

## GET /plays -プレー一覧取得

### 概要

指定条件に合致するプレーの一覧を取得します

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
<td>oekaki</td>
<td>検索対象とするゲームの識別子</td>
</tr>
<tr class="even">
<td>status</td>
<td>Array[String]</td>
<td><br />
</td>
<td><br />
</td>
<td>running</td>
<td><p>検索対象にするプレーのステータス</p>
<p>例) status[]=running, status[]=running&amp;status[]=broken </p></td>
</tr>
<tr class="odd">
<td>order</td>
<td>String</td>
<td><br />
</td>
<td>asc</td>
<td>asc</td>
<td><p>取得したプレーの並び順、 asc or desc を指定可能</p>
<p>playId をキーとして並び替えます</p></td>
</tr>
<tr class="even">
<td>_offset</td>
<td>Integer</td>
<td><br />
</td>
<td>0</td>
<td>0</td>
<td>取得開始位置を指定します。</td>
</tr>
<tr class="odd">
<td>_limit</td>
<td>Integer</td>
<td><br />
</td>
<td>10</td>
<td>100</td>
<td>取得数を指定します。 最大：100</td>
</tr>
<tr class="even">
<td>_count</td>
<td>Integer</td>
<td><br />
</td>
<td>0</td>
<td>0</td>
<td>1 を指定した場合、指定条件に合致するプレーの総件数を取得します。</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl ${ENDPOINT}/v1.0/plays?gameCode=oekaki&status=running&status[]=broken&_limit=2
```

### レスポンス

#### data要素

| キー名     | 型            | 概要                                                       |
| ---------- | ------------- | ---------------------------------------------------------- |
| values     | Array\[Play\] | が格納されます                                             |
| totalCount | Option\[Int\] | \_count を指定した場合、条件に合致するプレーの総件数が入る |

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "values": [
      {
        "gameCode": "oekaki",
        "started": "2017-02-08T03:17:06+0900",
        "status": "broken",
        "parentId": null,
        "id": "4",
        "finished": null
      },
      {
        "gameCode": "oekaki",
        "started": "2017-02-08T03:17:24+0900",
        "status": "running",
        "parentId": null,
        "id": "18",
        "finished": null
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

## POST /plays -プレー作成

### 概要

プレーの作成を行います

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
<td>◯</td>
<td><br />
</td>
<td>"oekaki"</td>
<td><p>プレーと紐付けるゲーム識別子を指定</p>
<p>新規プレー、 parent.playData を指定した場合は必須です</p></td>
</tr>
<tr class="even">
<td>parent</td>
<td>Object</td>
<td><br />
</td>
<td><br />
</td>
<td>{"playId": "123" }</td>
<td><p>派生プレー作成の場合にのみ指定します。</p>
<p>その際は、必ず playId か playData を指定してください。 両方指定した場合は、playData が優先されます。</p></td>
</tr>
<tr class="odd">
<td>parent.playId</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>1</td>
<td>派生元のプレーID</td>
</tr>
<tr class="even">
<td>parent.playData</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"(BINARY DATA)"</td>
<td><p>プレーログの元となる TickList を MessagePack &amp; base64 エンコードしたもの。<a href="specification_parameters.md#code-staticPlaylogWorker">staticPlaylogWorker</a> の playData に指定するデータと同じです。</p>
<p>詳細は<a href="plays_playlog.md">プレーログ API</a> を参照のこと。</p></td>
</tr>
<tr class="odd">
<td>parent.frame</td>
<td>Int</td>
<td><br />
</td>
<td><br />
</td>
<td>10000</td>
<td><p>派生元 playlog のデータをどこまで利用するかを指定します</p>
<ul>
<li>parent.playId 指定の場合
<ul>
<li>その時点で store されている対象プレー ID の最新のフレーム</li>
</ul></li>
<li>parent.playData 指定の場合
<ul>
<li>指定された playlog データの終端</li>
</ul></li>
</ul></td>
</tr>
<tr class="odd">
<td>nicoliveMetadata</td>
<td>Object</td>
<td><br />
</td>
<td><br />
</td>
<td>{"providerType": "official"}</td>
<td><p>ニコ生のメタ情報を保存し、後にplaylogの削除基準として利用します。ニコ生で使われていた名残です。</p></td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X POST ${ENDPOINT}/v1.0/plays -d '{"gameCode": "oekaki"}' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

作成した[プレー要素](specification_parameters.md#play) を data にいれて返します

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "gameCode": "oekaki",
    "started": "2017-02-08T18:48:37+0900",
    "status": "running",
    "parentId": null,
    "id": "47",
    "finished": null
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考           |
| ---------------- | --------------------- | -------------- |
| 400              | INVALID_PARAMETER     | ボディが不正   |
| 500              | INTERNAL_SERVER_ERROR | システムエラー |

## GET /plays/:id -プレー取得

### 概要

指定したIDのプレーを取得します

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
<td>◯</td>
<td><br />
</td>
<td>1</td>
<td>取得するプレーID</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl ${ENDPOINT}/v1.0/plays/77
```

### レスポンス

#### data要素

取得した[プレー要素](specification_parameters.md#play) を data にいれて返します

#### 成功

```json
{
  "meta": { "status": 200 },
  "data": {
    "gameCode": "oekaki",
    "started": "2017-02-08T18:48:37+0900",
    "status": "running",
    "parentId": null,
    "id": "47",
    "finished": null
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考               |
| ---------------- | --------------------- | ------------------ |
| 400              | INVALID_PARAMETER     | プレーIDが不正     |
| 404              | NOT_FOUND             | プレーが存在しない |
| 500              | INTERNAL_SERVER_ERROR | システムエラー     |

## DELETE /plays/:id -プレー停止

### 概要

指定したIDのプレーを停止します

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
<td>◯</td>
<td><br />
</td>
<td>1</td>
<td>停止するプレーID</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X DELETE ${ENDPOINT}/v1.0/plays/77
```

### レスポンス

#### data要素

更新した[プレー要素](specification_parameters.md#play) を data にいれて返します

#### 成功

```json
{
  "meta": { "status": 200 },
  "data": {
    "gameCode": "oekaki",
    "started": "2017-02-08T18:48:37+0900",
    "status": "suspending",
    "parentId": null,
    "id": "47",
    "finished": null
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考                                                                                          |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| 400              | INVALID_PARAMETER     | プレーIDが不正                                                                                |
| 404              | NOT_FOUND             | プレーが存在しない                                                                            |
| 409              | CONFLICT              | 指定したプレーが停止できない状態( status: prepare, running 以外の時に停止させようとした場合） |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                                                                                |

## GET /plays/:id/instances - プレー関連インスタンス取得

プレーに作成した[インスタンス](instances.md)を取得します。

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
<td>◯</td>
<td><br />
</td>
<td>1</td>
<td>インスタンス情報を取得するプレーID</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl ${ENDPOINT}/v1.0/plays/1/instances
```

### レスポンス

#### data要素

| キー名 | 型                 | 概要                                                                         |
| ------ | ------------------ | ---------------------------------------------------------------------------- |
| values | Array\[Instances\] | [インスタンス要素](specification_parameters.md#instance)の配列が格納されます |

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
        "id": "8",
        "gameCode": "oekaki",
        "status": "closed",
        "modules": [
          {
            "code": "staticPlaylogWorker",
            "values": {
              "playlog": {
                "playId": "1"
              },
              "loop": true
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
              "videoPublishUri": "rtmp://xxx.yyy.zzz/live/integrate-static-play1",
              "videoFrameRate": 10
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
        "id": "9",
        "gameCode": "oekaki",
        "status": "closed",
        "modules": [
          {
            "code": "staticPlaylogWorker",
            "values": {
              "playlog": {
                "playId": "1"
              },
              "loop": true
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
          }
        ],
        "region": "akashicCluster",
        "entryPoint": "engines/akashic/v1.0/entry.js",
        "cost": 1,
        "exitCode": 0,
        "processName": "game-runner-process-name"
      },
      {
        "id": "24",
        "gameCode": "final_final",
        "status": "running",
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
        "exitCode": 1,
        "processName": "game-runner-process-name"
      }
    ]
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考           |
| ---------------- | --------------------- | -------------- |
| 400              | INVALID_PARAMETER     | プレーIDが不正 |
| 500              | INTERNAL_SERVER_ERROR | システムエラー |

## PUT /plays/permit -プレーの権限更新

### 概要

[プレートークン API](plays_tokens.md) で発行されたプレートークンの権限を更新します。

更新対象を決めるパラメータとして、プレーID、ユーザID、プレートークン値を選択できます。

<table class="relative-table wrapped" style="width: 100.0%;">
<colgroup>
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 7%" />
<col style="width: 34%" />
<col style="width: 41%" />
</colgroup>
<tbody>
<tr class="header">
<th style="text-align: center;">プレーID</th>
<th style="text-align: center;">ユーザID</th>
<th style="text-align: center;">プレートークン値</th>
<th>対象範囲</th>
<th>例 (*1)</th>
</tr>

<tr class="odd">
<td style="text-align: center;">◯</td>
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;"><br />
</td>
<td>プレー内の全トークンを対象</td>
<td><p>特定のプレーに問題があるため、そのプレー全体を読み取り専用状態にする</p></td>
</tr>
<tr class="even">
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;">◯</td>
<td style="text-align: center;"><br />
</td>
<td>ユーザ ID が一致する全トークンを対象</td>
<td>問題のあるユーザに対し、全てのコンテンツの起動や参加を抑止する（= グローバル NG）</td>
</tr>
<tr class="odd">
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;">◯</td>
<td>指定したトークンのみを対象</td>
<td>特になし</td>
</tr>
<tr class="even">
<td style="text-align: center;">◯</td>
<td style="text-align: center;">◯</td>
<td style="text-align: center;"><br />
</td>
<td>プレー内のユーザ ID が一致するトークンを対象</td>
<td>問題のあるユーザに対し、特定のプレーにおけるコンテンツの起動や参加を抑止する</td>
</tr>
<tr class="odd">
<td style="text-align: center;">◯</td>
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;">◯</td>
<td><p>プレー内にトークンが存在する場合に対象</p></td>
<td>特になし（プレートークンのみ指定するケースと同等）</td>
</tr>
<tr class="even">
<td style="text-align: center;"><br />
</td>
<td style="text-align: center;">◯</td>
<td style="text-align: center;">◯</td>
<td><p>ユーザ ID に一致するトークンが存在する場合に対象</p></td>
<td>特になし（プレートークンのみ指定するケースと同等）</td>
</tr>
<tr class="odd">
<td style="text-align: center;">◯</td>
<td style="text-align: center;">◯</td>
<td style="text-align: center;">◯</td>
<td><p>プレー内にトークンが存在し、かつユーザ ID が一致するトークンが存在する場合に対象</p></td>
<td>特になし（プレートークンのみ指定するケースと同等）</td>
</tr>
</tbody>
</table>

- 表の (\*1)
  の導入にあたっては、で新規にトークンを発行する権限も改める必要があります。
  - この API
    はあくまで「現在認証済みのトークンに対して権限を更新する」ものであり、新規発行されるトークンには影響を及ぼしません。
-  で親子関係が設定されている場合は、対象トークンで認証された子のトークンも対象になります。このとき、子に対しても同一の
  permission を設定します。
  - 親と子のトークンを個別に更新したい場合は、親のトークンを更新後、子のトークンを更新してください。

### ボディ

<table class="relative-table wrapped" style="width: 100.0%;">
<colgroup>
<col style="width: 5%" />
<col style="width: 26%" />
<col style="width: 2%" />
<col style="width: 4%" />
<col style="width: 27%" />
<col style="width: 32%" />
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
<td>permission</td>
<td>String |</td>
<td>◯</td>
<td><br />
</td>
<td><p>"120"</p>
<p>{ "writeTick": true, "readTick": false, "maxEventPriority": 0 }</p></td>
<td><p>発行するトークンの権限レベル</p>
<p>または、 モデル</p>
<p>文字列とモデルの対応表は <a href="./specification_permission.md">こちら</a></p>
<p><strong>イベント優先度を指定したい場合は、 Permissionモデルで指定してください。</strong></p></td>
</tr>
<tr class="even">
<td>playId</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"1"</td>
<td>プレーID</td>
</tr>
<tr class="odd">
<td>tokenValue</td>
<td>String</td>
<td><br />
</td>
<td><br />
</td>
<td>"00501b8d6d2fc05505a92df32c9df63246789e746c16414270d3c0c955f66692"</td>
<td>プレートークン値。この値は公開すべきではありません。</td>
</tr>
<tr class="even">
<td>userId</td>
<td>String (最大長: 1,024)</td>
<td><br />
</td>
<td><br />
</td>
<td>"123"</td>
<td><p>プレートークンと紐付けるユーザーID</p></td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X PUT ${ENDPOINT}/v1.0/plays/permit -d '{ "permission": "100", "playId": "1", "userId": "123"}' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

meta のみ

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考                             |
| ---------------- | --------------------- | -------------------------------- |
| 400              | INVALID_PARAMETER     | リクエストパラメータが不正       |
| 404              | NOT_FOUND             | 対象のトークンが見つからなかった |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                   |

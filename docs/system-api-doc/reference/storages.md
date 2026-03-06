# ストレージ API

## GET /storages/content

### 概要

指定条件に合致するコンテンツストレージの一覧を取得します。

一部の例外を除いて、リクエストやレスポンスの項目は [content-storage-types](https://github.com/akashic-games/akashic-system/tree/main/packages/content-storage-types) の I/F と同様です。

### URIパラメータ

| キー           | 型            | 必須 | デフォルト | サンプル         | 備考                                                                                                                                                                                                                                              |
| -------------- | ------------- | ---- | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gameCode       | String        | ◯    |            | "oekaki"         | 検索対象とするゲームの識別子を指定します。                                                                                                                                                                                                        |
| playScope      | String        |      | "global"   | "play"           | 値のプレイに関するスコープ。 <br /> "play": プレイごとにユニークな領域 <br /> "rootPlay": もっとも祖先のプレイ (実質 akashic-nicocas) にユニークな領域 <br /> "global": プレイに紐づかない領域                                                    |
| key            | String        | ◯    |            | "test_key"       | 保存先を識別する文字列。                                                                                                                                                                                                                          |
| type           | String        | ◯    |            | "ordered-number" | ストレージに保存される値の種類。 <br /> "number", "ordered-number" は数値 (Infinity と NaN を除く)。 <br /> "string" は 文字列。(TODO 制限明記。何文字(？)以下など。) <br /> "general" は JSON として妥当なその他のオブジェクト。                 |
| playerIds      | Array[String] |      |            | "1234"           | 誰の値を読み込むか。 <br /> playerIdsが指定された場合、type が "ordered-number" である場合、エラー。 <br /> order と両方指定された場合、エラー。 <br /> order と両方指定されなかった場合、エラー。                                                |
| order          | String        |      |            | "asc"            | 読み込み順。結果はこの順でソートされ、 limit 個分取得される。 <br /> "asc": 昇順。type が `"ordered-number"` でない時、エラー。 <br /> "desc": 降順。type が `"ordered-number"` でない時、エラー。 <br /> "unspecified": 指定しない。デフォルト。 |
| limit          | Integer       |      |            | 10               | 読み込む個数。 <br /> 指定された場合、order が指定されていなければエラー。 0 未満の場合、エラー。 <br /> 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_LIMIT 。                                                    |
| offset         | Integer       |      |            | 1                | 読み込み開始位置。 <br /> 指定された場合、order が指定されていなければエラー。 0 未満の場合、エラー。 <br /> 省略された場合、order が指定されている場合のみ、DEFAULT_STORAGE_READ_REQUEST_OFFSET 。                                               |
| rankOfPlayerId | String        |      |            | "1234"           | 誰のランクを読み込むか。 <br /> rankOfPlayerId が指定された場合、type が "ordered-number" でない場合、エラー。 <br /> rankOfPlayerId が指定された場合、playerIds, order, limit, offset が指定された場合、エラー。                                 |
| playId         | String        |      |            | "1234"           | どのplayを読み込むか。 <br /> playScope が "play" または "rootPlay" の場合、必須項目。                                                                                                                                                            |

### リクエスト

```sh
curl ${ENDPOINT}/v1.0/storages/content?gameCode=test-ext-storage&key=test_ext_storage&type=string&playerIds[]=1234&playerIds[]=2345
```

### レスポンス

#### data要素

| キー名    | 型     | 概要                                                                                                                                                                                                                                                            |
| --------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gameCode  | String | 検索対象とするゲームの識別子を指定します。                                                                                                                                                                                                                      |
| playScope | String | 値のプレイに関するスコープ。 <br /> "play": プレイごとにユニークな領域 <br /> "rootPlay": もっとも祖先のプレイ (実質 akashic-nicocas) にユニークな領域 <br /> "global": プレイに紐づかない領域                                                                  |
| key       | String | 保存先を識別する文字列。                                                                                                                                                                                                                                        |
| type      | String | ストレージに保存される値の種類。 <br /> "number", "ordered-number" は数値 (Infinity と NaN を除く)。 <br /> "string" は 文字列。(TODO 制限明記。何文字(？)以下など。) <br /> "general" は JSON として妥当なその他のオブジェクト。                               |
| data      | Object | 読み込み結果。 <br /> `playerIds` による `read()` の結果である時、順序は `playerIds` に対応する。 <br /> (すなわち `playerIds[i]` は `data[i].playerId` と一致する) <br /> <br /> `order` による `read()` の結果である時、順序は `order` で指定された順である。 |

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "gameCode": "test-ext-storage",
    "playScope": "global",
    "key": "test_ext_storage",
    "type": "string",
    "data": [
      {
        "playerId": "1234",
        "value": "hoge_value"
      },
      {
        "playerId": "2345",
        "value": "fuga_value"
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

## POST /storages/content

### 概要

コンテンツストレージの作成を行います。

一部の例外を除いて、リクエストやレスポンスの項目は [content-storage-types](https://github.com/akashic-games/akashic-system/tree/main/packages/content-storage-types) の I/F と同様です。

### ボディ

| キー      | 型      | 必須 | デフォルト  | サンプル                                      | 備考                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------- | ---- | ----------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| data      | Object  | ◯    |             | [{"playerId": "1234", "value": "hoge_value"}] | プレイヤー別のデータ。                                                                                                                                                                                                                                                                                                               |
| writeType | String  |      | "overwrite" | "incr"                                        | 書き込みのタイプ (書き込む値の解釈)。 <br /> "incr": 指定された値を現在値に加えた値を書き込む。 type が `"number" or "ordered-number"` でない時エラー。 <br /> "decr": 指定された値を現在値から引いた値を書き込む。 type が `"number" or "ordered-number"` でない時エラー。 <br /> "overwrite": 指定された値を書き込む。デフォルト。 |
| min       | Integer |      |             | 10                                            | 最小値。                                                                                                                                                                                                                                                                                                                             |
| max       | Integer |      |             | 100                                           | 最大値。                                                                                                                                                                                                                                                                                                                             |

### リクエスト

```sh
curl -X POST ${ENDPOINT}/v1.0/storages/content -d '{     "key": "test_ext_storage",     "gameCode": "test-ext-storage",     "type": "string",     "data": [{             "playerId": "1234",             "value": "hoge_value"         },         {             "playerId": "2345",             "value": "fuga_value"         },         {             "playerId": "3456",             "value": "piyo_value"         }     ] }' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

書き込み失敗情報の配列を data にいれて返します。
全ての書き込みに成功した場合は空配列になります。

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "failed": []
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考           |
| ---------------- | --------------------- | -------------- |
| 400              | INVALID_PARAMETER     | ボディが不正   |
| 500              | INTERNAL_SERVER_ERROR | システムエラー |

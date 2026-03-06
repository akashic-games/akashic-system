# プレートークン API

プレートークンの権限については、[実行方式と権限](../how_to_use/permission_by_execution_mode.md)を参照してください。

## POST /plays/:id/tokens

### 概要

プレートークンの発行を行います

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
<td><br />
</td>
<td><br />
</td>
<td>1</td>
<td>プレートークンを発行する対象のプレーID</td>
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
<td>permission</td>
<td><a href="specification_parameters.md#permission">Permission</a> | String</td>
<td><br />
</td>
<td><br />
</td>
<td><p>{ "writeTick": true, "readTick": false, "maxEventPriority": 0 }</p></td>
<td><p>発行するトークンの権限。</p>
<p><a href="specification_parameters.md#permission">Permission</a>を参照のこと。</p>
<p><a href="specification_permission.md">文字列で指定することも可能</a>だが現在は非推奨。</p>
</tr>
<tr class="even">
<td>userId</td>
<td>String (最大長: 1024)</td>
<td>☓</td>
<td><br />
</td>
<td>"123"</td>
<td><p>プレートークンと紐付けるユーザーID</p>
<p>":" で始まるユーザ ID はシステム内で予約されているため、使用できません。</p></td>
</tr>
<tr class="odd">
<td>ttl</td>
<td>Int</td>
<td>☓</td>
<td>14400 (4時間)</td>
<td>3600</td>
<td><p>プレートークンの認可待ち寿命 (秒)</p>
<p>Dispatchingを利用する場合このパラメータの値は適用されず、60秒でタイムアウトになります</p></td>
</tr>
<tr class="even">
<td>trait</td>
<td>String</td>
<td>☓</td>
<td>standard_websocket</td>
<td>"standard_websocket"</td>
<td><p>接続先のプレーログサーバーを選定するためのプロトコル情報</p>
<p>特に理由がない限り "standard_websocket" を指定してください。</p></td>
</tr>
<tr class="odd">
<td>reserveEndpoint</td>
<td>boolean</td>
<td>☓</td>
<td>true</td>
<td><br />
</td>
<td>false が指定された場合、プレーログサーバの割り当てを行いません。すでにプレーログサーバとの接続が確立している状態で、トークンのみ必要な場合に false を設定してください。</td>
</tr>
<tr class="even">
<td>forceAssignTo</td>
<td>String</td>
<td>☓</td>
<td><br />
</td>
<td><br />
</td>
<td><p>割り当て先のプレーログサーバを強制指定するオプションです。</p>
<p>デバッグ/解析用途のパラメータであるため、通常使用時には指定しないでください。</p></td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X POST ${ENDPOINT}/v1.0/plays/5/tokens -d '{"permission": "100", "userId": "12345"}' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

[プレートークン](specification_parameters.md#playtoken) を data に入れて返します。

permission は、 "120" 等の文字列でリクエストされた場合は文字列で返します。

#### 成功

```json
{
  "meta": {
    "status": 200
  },
  "data": {
    "id": "61113",
    "playId": "47",
    "value": "00501b8d6d2fc05505a92df32c9df63246789e746c16414270d3c0c955f66692",
    "expire": "2017-02-09T22:43:10+0900",
    "url": "ws://xxx.yyy.zzz:1234",
    "permission": {
      "writeTick": true,
      "readTick": false,
      "subscribeTick": true,
      "sendEvent": true,
      "subscribeEvent": true,
      "maxEventPriority": 2
    },
    "meta": {
      "userId": "111"
    }
  }
}
```

#### 失敗

| ステータスコード | エラーコード          | 備考                                                             |
| ---------------- | --------------------- | ---------------------------------------------------------------- |
| 400              | INVALID_PARAMETER     | リクエストパラメータが不正                                       |
| 404              | NOT_FOUND             | 対象のプレーが見つからなかった                                   |
| 409              | CONFLICT              | 終了したプレーに対して書き込み権限でトークンの発行を行おうとした |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                                                   |
| 503              | SERVICE_UNAVAILABLE   | プレーログサーバーへの割当に失敗した                             |

## DELETE /plays/:id/tokens/purge

### 概要

発行された未認証のプレートークンを破棄します

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
<td>String</td>
<td> ◯</td>
<td><br />
</td>
<td>1</td>
<td>削除対象となるトークンと紐づくプレーのID</td>
</tr>
</tbody>
</table>

### ボディ

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
<td>value</td>
<td>String</td>
<td>◯ </td>
<td><br />
</td>
<td>"00501b8d6d2fc05505a92df32c9df63246789e746c16414270d3c0c955f66692"</td>
<td>プレートークン値</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X DELETE ${ENDPOINT}/v1.0/plays/5/tokens/purge -d '{"value": "1969ea7ded1771f6ce01b032051278016d562692843b37dfcf3ea867e08f0cdb"}' -H
'Accept: application/json'
```

### レスポンス

#### data要素

meta のみ

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考                           |
| ---------------- | --------------------- | ------------------------------ |
| 400              | INVALID_PARAMETER     | リクエストパラメータが不正     |
| 404              | NOT_FOUND             | 対象のプレーが見つからなかった |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                 |

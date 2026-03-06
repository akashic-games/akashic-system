# プレーの親子関係 API

## POST v1.0/plays/:id/children

### 概要

プレーに対して親子関係を設定します。[プレートークン発行負荷の低減](../how_to_use/reuse_playtoken.md)を目的として利用されます。

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
<td>123</td>
<td>親となるプレーID</td>
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
<td> childId</td>
<td>BigInt </td>
<td>◯ </td>
<td><br />
</td>
<td>456 </td>
<td>子となるプレーID </td>
</tr>
<tr class="even">
<td>allow</td>
<td>Object ()</td>
<td>×</td>
<td><br />
</td>
<td><div class="content-wrapper">
<p>親プレーの権限にかかわらず、子プレーのイベント送信を許可する例</p>
{ "sendEvent": true, "maxEventPriority": 1 }
</div></td>
<td><p>トークン照合しない場合の親プレーから子プレーへの権限引き継ぎ方法を指定します。</p>
<p>子プレーに対して、<strong>付与したいパーミッションに true</strong> を設定します。</p>
<p>maxEventPriority が指定された場合、親プレーの maxEventPriority が指定された値より小さい場合にこの値まで引き上げられます。</p>
<p>指定がないパーミッションに関しては、親プレーの権限を引き継ぎます。</p>
<p>allow、deny ともに指定されない場合は、親プレーと子プレーのの権限は同一になります。</p>
<p>allow、deny ともに指定された場合は、allow -&gt; deny の順で適用されます。</p></td>
</tr>
<tr class="odd">
<td>deny</td>
<td>Object ()</td>
<td>×</td>
<td> </td>
<td><div class="content-wrapper">
<p>親プレーの権限にかかわらず、子プレーのイベント送信を拒否する例</p>
{ "sendEvent": true, }
</div></td>
<td><p>トークン照合しない場合の親プレーから子プレーへの権限引き継ぎ方法を指定します。</p>
<p>子プレーに対して、<strong>落としたいパーミッションに true</strong> を設定します。</p>
<p>maxEventPriority が指定された場合、親プレーの maxEventPriority が指定された値より大きい場合にこの値まで引き下げられます。</p>
<p>指定がないパーミッションに関しては、親プレーの権限を引き継ぎます。</p>
<p>allow、deny ともに指定されない場合は、親プレーと子プレーのの権限は同一になります。</p>
<p>allow、deny ともに指定された場合は、allow -&gt; deny の順で適用されます。</p></td>
</tr>
<tr class="even">
<td>authorizedFlag</td>
<td>string</td>
<td>×</td>
<td> </td>
<td>"isAuthorizedUser"</td>
<td><p>プレートークンごとに子プレーの照合を許可/不許可を切り替える際に指定します。</p>
<p>本パラメータが指定された場合、子プレー認証時にプレートークンの meta 情報内に本パラメータで指定されたフラグが存在するかどうかチェックされます。meta 内に本パラメータで指定されたメンバが存在し、その型が boolean で値が true のときのみ子プレー認証が成功します。メンバが存在しなかったり、値が true でない場合は子プレー認証は失敗します。</p>
<p>本パラメータが指定されなかった場合、すべてのプレートークンに対して子プレーの認証を許可します。</p></td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X POST ${ENDPOINT}/v1.0/plays/1/children -d '{"childId":"2"}' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

meta のみ

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考               |
| ---------------- | --------------------- | ------------------ |
| 400              | INVALID_PARAMETER     | プレーIDが不正     |
| 404              | NOT_FOUND             | プレーが存在しない |
| 500              | INTERNAL_SERVER_ERROR | システムエラー     |

## DELETE v1.0/plays/:id/children/:childId

### 概要

設定されたプレーの親子関係を削除します

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
<td> id</td>
<td>BigInt </td>
<td>◯ </td>
<td><br />
</td>
<td>123</td>
<td>親プレーのID </td>
</tr>
<tr class="even">
<td>childId</td>
<td>BigInt</td>
<td>◯</td>
<td><br />
</td>
<td>456</td>
<td>子プレーのID</td>
</tr>
</tbody>
</table>

### リクエスト

```sh
curl -X DELETE ${ENDPOINT}v1.0/plays/1/children/2
```

### レスポンス

#### data要素

meta のみ

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考           |
| ---------------- | --------------------- | -------------- |
| 400              | INVALID_PARAMETER     | プレーIDが不正 |
| 500              | INTERNAL_SERVER_ERROR | システムエラー |

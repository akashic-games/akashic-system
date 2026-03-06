# プレーログイベント API

## POST /plays/:id/events

### 概要

指定されたプレーに対して特定の[プレーログイベント](https://github.com/akashic-games/playlog#event)を送信します。

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
<td>プレーログイベントを送る対象のプレーID</td>
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
<td>type</td>
<td>String </td>
<td>◯ </td>
<td><br />
</td>
<td>"JoinPlayer" </td>
<td>送信するイベントの種別</td>
</tr>
<tr class="even">
<td>values </td>
<td>Object </td>
<td>◯ </td>
<td><br />
</td>
<td> { "userId": "123" }</td>
<td>送信するイベントの内容</td>
</tr>
</tbody>
</table>

#### values の規定

values は type
によって送信できるフォーマットが以下のように決まっています。

##### type: JoinPlayer

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
<td>userId</td>
<td>BigInt</td>
<td>◯</td>
<td><br />
</td>
<td>"12345"</td>
<td>プレーに参加するユーザーのID</td>
</tr>
<tr class="even">
<td>name</td>
<td>String</td>
<td>◯</td>
<td><br />
</td>
<td>"abcde"</td>
<td>プレーに参加するユーザーの名前</td>
</tr>
</tbody>
</table>

##### type: LeavePlayer

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
<td>userId</td>
<td>BigInt</td>
<td>◯</td>
<td><br />
</td>
<td>"12345"</td>
<td>プレーから離脱するユーザーのID</td>
</tr>
</tbody>
</table>

##### type: Message

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
<td>userId</td>
<td>BigInt / String</td>
<td>◯</td>
<td><br />
</td>
<td>"12345"</td>
<td><p>Messageイベントを送信するユーザーID</p>
<p>ある操作者からのイベントを表現する場合は BigInt での指定となりますが、システムからの特別なイベントを表すために ":akashic" などの文字列を指定することもできます。</p></td>
</tr>
<tr class="even">
<td>event</td>
<td>Any</td>
<td>◯</td>
<td><br />
</td>
<td>別記<br />
</td>
<td>任意の型のイベント情報（後述のリクエストサンプル参照）</td>
</tr>
<tr class="odd">
<td>priority</td>
<td>Int</td>
<td><br />
</td>
<td> 3</td>
<td><br />
</td>
<td><p>イベントの優先度</p>
<p>0 ～ 3 で、値が高いほど優先的に処理されます。優先度 0 ～ 2 のイベントは状況により配送途中で破棄される可能性があります。</p></td>
</tr>
<tr class="even">
<td>excludeEventFlags</td>
<td>object</td>
<td><br />
</td>
<td>{ transient: true }</td>
<td><br />
</td>
<td><p>playlogから除外すべきイベントであるかどうかを示すフラグです</p>
<ul>
<li>transient: 非永続化フラグ
<ul>
<li>{ "transient": true } のとき、対象のイベントは永続化されないことを許容します。</li>
<li>システムとしてイベントを永続化しません。対象のイベントはリアルタイム実行時にのみ送信され、リプレー時には再現対象となりません。</li>
</ul></li>
<li>ignorable: 省略可能フラグ
<ul>
<li>{ "ignorable": true } のとき、対象のイベントは任意のタイミングで欠落しうること許容します。</li>
<li>システムの Tick 取得要求時にこのイベントを省略することができます。たとえば「game-driver のスキップ時は通信量低減のため省略する」などの利用方法を想定しています。</li>
</ul></li>
</ul>
<p>
もし両方のフラグが指定されていた場合、transientが優先して処理されます。<br />
<p>処理の実体としては、発行されるイベントのtransient、ignorableフラグを立てるものとなります。これらフラグそのものに関しては<a href="https://github.com/akashic-games/playlog#%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88%E3%83%95%E3%83%A9%E3%82%B0">playlogリポジトリの当該項目</a>を参照ください。</p>
</td>
</tr>
</tbody>
</table>

### リクエスト

#### イベントとリクエストパラメータの対応

[akashic-games/playlog](https://github.com/akashic-games/playlog) で定義されている Message イベントの例は以下の通り。
ここで、Index:0 の `32` は EventCode: `0x20`（= MessageEvent, 汎用的なデータ）を、Index:1 は Priority: 2 を指定していることを表す。

```json
[
  32,
  2,
  ":akashic",
  {
    "type": "start",
    "parameters": {
      "mode": "multi",
      "service": "sample-service"
    }
  }
]
```

これを API で送信する場合は、`type: "Message"`, `userId: ":akashic", "priority": 2` とし、`event` に `{ "type": "start", "parameters":{ ... } }` と指定する。

```json
{
  "type": "Message",
  "values": {
    "userId": ":akashic",
    "priority": 2,
    "event": {
      "type": "start",
      "parameters": {
        "mode": "multi",
        "service": "atsumaru"
      }
    }
  }
}
```

#### コマンド例

```sh
curl -X POST ${ENDPOINT}/v1.0/plays/5/events -d '{"type": "JoinPlayer", "values":{"userId": "1", "name": "gorilla"} }' -H 'Accept: application/json' -H 'Content-type: application/json'
```

### レスポンス

#### data要素

なし、 meta のみ

#### 成功

```json
{ "meta": { "status": 200 } }
```

#### 失敗

| ステータスコード | エラーコード          | 備考                                                                                             |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| 400              | INVALID_PARAMETER     | プレーIDが不正。 type に対して values の内容が正しくない。 サポートしていない typeが指定された。 |
| 404              | NOT_FOUND             | イベントの送信先が見つからなかった (該当プレーが running 状態でない場合に起こります)。           |
| 500              | INTERNAL_SERVER_ERROR | システムエラー                                                                                   |

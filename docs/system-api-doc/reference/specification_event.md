# イベント通知仕様

## 概要

Akashic System で取り扱うイベント通知について記述する。

イベント通知機構は、事前にイベント通知先のエンドポイントを登録し、発生時にリクエストを発生させるものである。
現状は HTTP 通知をサポートしている。

## イベント一覧 

[インスタンス作成時](instances.md)の modules に [eventHandlers](specification_parameters.md#code-eventhandlers) を登録することで、インスタンスのイベント通知を受け取ることができる。

### イベント種別

| No  | type           | 名称             | 解説                                                   | 備考 |
| --- | -------------- | ---------------- | ------------------------------------------------------ | ---- |
| 1   | error          | エラー           | インスタンスに関連するなんらかのエラーが起きた事を表す |      |
| 2   | instanceStatus | インスタンス状態 | インスタンスの状態が変更されたことを表す               |      |
| 3   | gameEvent      | ゲームイベント   | ゲーム固有のイベントが要求されたことを表す             |      |

 

###  イベント - エラー

なんらかのエラーが起きたことを表す。

クライアントサービスはこのイベントに応じて、プレーの終了や、インスタンスの再起動等を行う事で、より安定したサービス提供をすることが出来る。

#### パラメータ 

<table style="width:100%;">
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
<th>No</th>
<th>フィールド名</th>
<th>値</th>
<th>nullable</th>
<th>解説</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>1</td>
<td>category</td>
<td>string</td>
<td>☓</td>
<td><p>"Error"固定</p></td>
<td> </td>
</tr>
<tr class="even">
<td>2</td>
<td>id</td>
<td>string</td>
<td>☓</td>
<td>イベント自体のID</td>
<td> </td>
</tr>
<tr class="odd">
<td>3</td>
<td>type</td>
<td>string</td>
<td>☓</td>
<td>"error"固定</td>
<td> </td>
</tr>
<tr class="even">
<td>4</td>
<td><p>payload</p></td>
<td>object</td>
<td>☓</td>
<td>エラー情報を表すオブジェクト</td>
<td> </td>
</tr>
<tr class="odd">
<td>5</td>
<td>payload.playId</td>
<td>bigint</td>
<td>☓</td>
<td>エラーが発生したプレーのID</td>
<td> </td>
</tr>
<tr class="even">
<td>6</td>
<td>payload.code</td>
<td>int</td>
<td>☓</td>
<td>エラーコードを表す。詳細は後述</td>
<td> </td>
</tr>
<tr class="odd">
<td>7</td>
<td>payload.description</td>
<td>string</td>
<td>○</td>
<td>エラーの詳細情報</td>
<td> </td>
</tr>
</tbody>
</table>

#### code一覧

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<tbody>
<tr class="header">
<th>code</th>
<th>説明</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>1</td>
<td>インスタンスでプログラム異常終了</td>
<td> </td>
</tr>
<tr class="even">
<td>2</td>
<td>インスタンスの終了処理に失敗</td>
<td> </td>
</tr>
<tr class="odd">
<td>3</td>
<td>インスタンスのリソースに空きがない</td>
<td> </td>
</tr>
<tr class="even">
<td>4</td>
<td>インスタンスのビデオ出力で問題発生</td>
<td> </td>
</tr>
</tbody>
</table>

#### イベント例

```json
{ "category": "Error", "id": "1", "type": "error", "payload": { "playId": "3863", "code": 1 } }
```

### イベント - インスタンス状態

インスタンス生成後に状態が変更されたことを表す 。

クライアントサービスはこのイベントに応じて、インスタンスが完全に起動完了してからユーザに接続を開始させる、インスタンスが終了したらユーザに表示する映像を切り替える等、Akashicのクラスタ状態に応じた詳細な制御を行う事が出来る。

#### パラメータ

<table style="width:100%;">
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
<th>No</th>
<th>フィールド名</th>
<th>値</th>
<th>nullable</th>
<th>解説</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>1</td>
<td>category</td>
<td>string</td>
<td>☓</td>
<td><p>"Error"または"Info"</p></td>
<td> </td>
</tr>
<tr class="even">
<td>2</td>
<td>id</td>
<td>string</td>
<td>☓</td>
<td>イベント自体のID</td>
<td> </td>
</tr>
<tr class="odd">
<td>3</td>
<td>type</td>
<td>string</td>
<td>☓</td>
<td>"instanceStatus"固定</td>
<td> </td>
</tr>
<tr class="even">
<td>4</td>
<td><p>payload</p></td>
<td>object</td>
<td>☓</td>
<td>インスタンス情報を表すオブジェクト</td>
<td> </td>
</tr>
<tr class="odd">
<td>6</td>
<td>payload.instanceId</td>
<td>bigint</td>
<td>☓</td>
<td>そのインスタンス自身のID</td>
<td> </td>
</tr>
<tr class="even">
<td>7</td>
<td>payload.status</td>
<td>string</td>
<td>☓</td>
<td><p>インスタンスの状態(Akashic)で定義される値 ("prepare" 除く)</p>
<p>"prepare" は、初期状態かつ遷移元が存在しないので、本イベントで通知されることはない</p></td>
<td> </td>
</tr>
<tr class="odd">
<td>8</td>
<td>payload.exitCode</td>
<td>int</td>
<td>○</td>
<td>インスタンスが終了していた場合、その終了理由。詳細は後述</td>
<td> </td>
</tr>
<tr class="even">
<td>9</td>
<td>payload.description</td>
<td>string</td>
<td>○</td>
<td>インスタンスの終了理由</td>
<td> </td>
</tr>
</tbody>
</table>

#### exitCode一覧 

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
</colgroup>
<tbody>
<tr class="header">
<th>code</th>
<th>説明</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>0</td>
<td>正常終了</td>
<td> </td>
</tr>
<tr class="even">
<td>1</td>
<td>プログラム異常終了</td>
<td> </td>
</tr>
<tr class="odd">
<td>2</td>
<td>終了処理に失敗</td>
<td> </td>
</tr>
<tr class="even">
<td>3</td>
<td>リソースに空きがない</td>
<td> </td>
</tr>
<tr class="odd">
<td>4</td>
<td>ビデオ出力で問題発生</td>
<td> </td>
</tr>
</tbody>
</table>

#### イベント例

```json
{ "category": "Info", "id": "1", "type": "instanceStatus", "payload": { "playId": "3863", "instanceId": "10001", "status": "running" } }
```

### イベント - ゲームイベント

そのプレーのゲーム固有のイベントが要求されたことを表す。

#### パラメータ

<table style="width:100%;">
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
<th>No</th>
<th>フィールド名</th>
<th>値</th>
<th>nullable</th>
<th>解説</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>1</td>
<td>category</td>
<td>string</td>
<td>☓</td>
<td><p>"Info"固定</p></td>
<td> </td>
</tr>
<tr class="even">
<td>2</td>
<td>id</td>
<td>string</td>
<td>☓</td>
<td>イベント自体のID</td>
<td> </td>
</tr>
<tr class="odd">
<td>3</td>
<td>type</td>
<td>string</td>
<td>☓</td>
<td>"gameEvent"固定</td>
<td> </td>
</tr>
<tr class="even">
<td>4</td>
<td><p>payload</p></td>
<td>object</td>
<td>☓</td>
<td>ゲーム情報を表すオブジェクト</td>
<td> </td>
</tr>
<tr class="odd">
<td>5</td>
<td>payload.playId</td>
<td>bigint</td>
<td>☓</td>
<td>そのプレーID</td>
<td> </td>
</tr>
<tr class="even">
<td>6</td>
<td>payload.type</td>
<td>string</td>
<td>☓</td>
<td>ゲーム情報種別</td>
<td>ゲーム側で定義されている値</td>
</tr>
<tr class="odd">
<td>7</td>
<td>payload.data</td>
<td>dynamic</td>
<td>☓</td>
<td>更新された情報</td>
<td>ゲーム固有の型なのでdynamic</td>
</tr>
</tbody>
</table>

#### イベント例

最大参加人数、現在参加人数からなる抽選という情報の変更通知を表すJSONを以下に示す。

```json
{
  "category": "Info",
  "id": "1",
  "type": "gameEvent",
  "payload": { "playId": "3863", "type": "lottery", "data": { "currentNumberOfParticipants": 10, "maxNumberOfParticipants": 100 } }
}
```

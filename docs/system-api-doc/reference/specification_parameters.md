# System API で利用されるパラメータ仕様

## 注意事項

- `BigInt` 型の値に関しては、JSON では `String` で表現されています。

## Play

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td><br />
</td>
<td>”1"</td>
<td>プレーID</td>
</tr>
<tr class="even">
<td>gameCode</td>
<td>String</td>
<td><br />
</td>
<td>"oekaki"</td>
<td>実行したゲームコード</td>
</tr>
<tr class="odd">
<td>parentId</td>
<td>BigInt</td>
<td>◯</td>
<td>NULL</td>
<td>派生元のプレーID (ここからプレーの際に利用します）</td>
</tr>
<tr class="even">
<td>started</td>
<td>DateTime</td>
<td><br />
</td>
<td>"2017-01-01T00:00:00+0900"</td>
<td>プレー開始日時</td>
</tr>
<tr class="odd">
<td>finished</td>
<td>DateTime</td>
<td>◯</td>
<td>"2017-01-01T00:00:00+0900"</td>
<td>プレーの最終更新日</td>
</tr>
<tr class="even">
<td>status</td>
<td>String</td>
<td><br />
</td>
<td>"suspending"</td>
<td></td>
</tr>
</tbody>
</table>

## PlayToken

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td><br />
</td>
<td>"1"</td>
<td>トークンID</td>
</tr>
<tr class="even">
<td>playId</td>
<td>BigInt</td>
<td><br />
</td>
<td>"123"</td>
<td>プレーID</td>
</tr>
<tr class="odd">
<td>value</td>
<td>String</td>
<td><br />
</td>
<td><pre><code>&quot;00501b8d6d2fc05505a92df32c9df63246789e746c16414270d3c0c955f66692&quot;</code></pre></td>
<td>プレートークン値</td>
</tr>
<tr class="even">
<td>expire</td>
<td>DateTime</td>
<td><br />
</td>
<td><pre><code>&quot;2017-02-09T22:43:10+0900&quot;</code></pre></td>
<td>トークンの有効期限</td>
</tr>
<tr class="odd">
<td>url</td>
<td>String</td>
<td><br />
</td>
<td><pre><code>&quot;ws://xxx.yyy.zzz:1234&quot;</code></pre></td>
<td>このトークンの接続先となるサーバ</td>
</tr>
<tr class="even">
<td>permission</td>
<td>Object</td>
<td><br />
</td>
<td><p>{ "writeTick": true, "readTick": false, "maxEventPriority": 0 }</p></td>
<td><p>トークンの持つ権限</p>
<p>または、</p></td>
</tr>
<tr class="odd">
<td>meta</td>
<td>Object</td>
<td><br />
</td>
<td>{ "userId": "111" }</td>
<td><p>トークンに付与されているメタ情報 ( 2017年現在、 userId のみです）</p>
<ul>
<li>userId: String (最大長 1,024)</li>
</ul></td>
</tr>
</tbody>
</table>

## Permission

文字列で表現されるPlayToken権限をモデルで表現したもの。に具体的な利用方法について記述しています。

### 注意

readTick 以外の権限は、対象の Play の status が running である必要があります。[権限についてはこちら](../how_to_use/permission_by_execution_mode.md#権限)。

- readTick は、対象の Play の status が suspending でも動作します。
- これは、**「プレー中でないとプレーログの書き込みやリアルタイム送受信ができない」**ということを表します。読み込みに限り、プレー終了後も過去のプレーログを参照することができます。

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>writeTick</td>
<td>Boolean</td>
<td>◯</td>
<td>false</td>
<td>Tickを記録する権限を持つかどうか、省略した場合falseとなり権限は付与されません。</td>
</tr>
<tr class="even">
<td>readTick</td>
<td>Boolean</td>
<td>◯</td>
<td>true</td>
<td><p>Tickを読み込む権限を持つかどうか、省略した場合falseとなり権限は付与されません。</p></td>
</tr>
<tr class="odd">
<td>subscribeTick</td>
<td>Boolean</td>
<td>◯</td>
<td>false</td>
<td>リアルタイムに発行されるTickを受信する権限を持つかどうか、省略した場合falseとなり権限は付与されません。</td>
</tr>
<tr class="even">
<td>sendEvent</td>
<td>Boolean</td>
<td>◯</td>
<td>true</td>
<td>イベントを送信する権限を持つかどうか、省略した場合falseとなり権限は付与されません。</td>
</tr>
<tr class="odd">
<td>subscribeEvent</td>
<td>Boolean</td>
<td>◯</td>
<td>false</td>
<td>送信されたイベントを受信する権限を持つかどうか、省略した場合falseとなり権限は付与されません。</td>
</tr>
<tr class="even">
<td>maxEventPriority</td>
<td>Integer</td>
<td><br />
</td>
<td>1</td>
<td>送信できるイベントに指定できる最大優先度（0〜3の範囲で指定できます）</td>
</tr>
</tbody>
</table>

## Instance

<table class="wrapped">
<colgroup>
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
</colgroup>
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>id</td>
<td>BigInt</td>
<td><br />
</td>
<td>"1"</td>
<td>インスタンスID</td>
</tr>
<tr class="even">
<td>gameCode</td>
<td>String</td>
<td><br />
</td>
<td>"oekaki"</td>
<td>ゲームコード</td>
</tr>
<tr class="odd">
<td>status</td>
<td>String</td>
<td><br />
</td>
<td>"closed"</td>
<td></td>
</tr>
<tr class="even">
<td>modules</td>
<td>の配列</td>
<td>◯ </td>
<td><br />
</td>
<td>モジュール</td>
</tr>
<tr class="odd">
<td>region</td>
<td>String</td>
<td><br />
</td>
<td>"akashicCluster"</td>
<td>※内部用 インスタンスの稼働先。 現在は akashicClusterのみ。</td>
</tr>
<tr class="even">
<td>entryPoInt</td>
<td>String</td>
<td><br />
</td>
<td>"engines/akashic/v1.0/entry.js"</td>
<td>実行する js ファイルのパス</td>
</tr>
<tr class="odd">
<td>cost</td>
<td>Int</td>
<td><br />
</td>
<td>1</td>
<td>割当コスト</td>
</tr>
<tr class="even">
<td>exitCode</td>
<td>Int</td>
<td>◯</td>
<td>0</td>
<td>終了コード</td>
</tr>
<tr class="odd">
<td>processName</td>
<td>String</td>
<td>◯</td>
<td>"game-runner-process-name"</td>
<td>インスタンス稼働先のプロセス(game-runner)識別子</td>
</tr>
</tbody>
</table>

## Module

モジュールは code によって、様々な種類に分類されます。

<table class="wrapped">
<colgroup>
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
<col style="width: 20%" />
</colgroup>
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>code</td>
<td>String</td>
<td><br />
</td>
<td>"dynamicPlaylogWorker"</td>
<td>モジュール識別子</td>
</tr>
<tr class="even">
<td>values</td>
<td>Object</td>
<td><br />
</td>
<td><br />
</td>
<td>モジュール固有の値、 code により異なるので後述</td>
</tr>
</tbody>
</table>

### code: dynamicPlaylogWorker

動的なプレーログを入出力しゲームを実行するモジュール。指定したプレーIDのプレーログを入出力先とします。

インスタンス終了APIが行われない限り、そのプレーを入出力先として動作し続けます。エラーを除き自動的に終了することはありません。

 staticPlaylogWorkerとは対となる存在。

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>playId</td>
<td>BigInt</td>
<td><br />
</td>
<td>"2" </td>
<td><p>プレーログ入出力先のプレーID、executionModeによって入出力が変わります。</p>
<p>active: プレーログの出力先</p>
<p>passive: プレーログの入力先</p></td>
</tr>
<tr class="even">
<td>executionMode</td>
<td>String</td>
<td><br />
</td>
<td>"active"</td>
<td><p>実行モード。主体でゲームを実行する active、プレーログに従う passive の何れかとなります。</p>
<p>passive の場合は、プレーログの最新のフレームまで最速で追いつこうとする振る舞い（早回しモード）となります。</p></td>
</tr>
<tr class="odd">
<td>frameRateRatio</td>
<td>Int</td>
<td>◯</td>
<td>1</td>
<td><p>フレームレートの係数。executionMode: active のときに有効となります。省略時は 1 (等速) です。</p></td>
</tr>
</tbody>
</table>

### code: staticPlaylogWorker

静的なプレーログを入力しゲームを実行するモジュール。指定したプレーID・またはプレーログのデータそのものを入力とします。

インスタンス終了APIが行われるか、プレーログ全てを入力し終わるとそのインスンタンスは終了します。

dynamicPlaylogWorkerとは対となる存在です。

このモジュールが動作するインスタンスへの Permission は、readTick
のみサポートします。subscribeTick
などの「リアルタイムにプレーログに追従する」経路はサポートしておりません。

仮に指定した場合、サーバへの AMFlow 接続時の authenticate
でエラーとなるでしょう。

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>playlog</td>
<td>Object</td>
<td><br />
</td>
<td><br />
</td>
<td><p>Object 型で、 playId または playData のどちらかを指定します。</p></td>
</tr>
<tr class="even">
<td>frameRateRatio</td>
<td>Int</td>
<td>◯ </td>
<td>1</td>
<td><p>seek 以降のフレームを再生する際の再生速度の係数。(1 で等速)</p>
<p>デフォルト： 1 </p></td>
</tr>
<tr class="odd">
<td>seek</td>
<td>Int</td>
<td>◯</td>
<td> 0</td>
<td><p>リプレーの開始ageを指定する。 この指定ageより前の部分は、システムが達成可能な最高速で進行処理が行われます。</p>
<p>デフォルト： 0</p></td>
</tr>
<tr class="even">
<td>terminateAge</td>
<td>Int</td>
<td>◯</td>
<td> 9999</td>
<td><p>プレーを終了させるageを指定します</p></td>
</tr>
<tr class="odd">
<td>enableSnapshot</td>
<td>Boolean</td>
<td>◯</td>
<td> true</td>
<td>スナップショットを利用するかどうか</td>
</tr>
</tbody>
</table>

#### \#playlog 要素について

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>必須</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>playId</td>
<td>String</td>
<td><br />
</td>
<td>プレーログの入力先となるプレーID</td>
</tr>
<tr class="even">
<td>playData</td>
<td>String</td>
<td><br />
</td>
<td><div class="content-wrapper">
<p>プレーログの元となる TickList を MessagePack &amp; base64 エンコードしたもの</p>
{ tickList: [from, to, [...]], startPoints: [{frame: 0, data: {...}, ...] }
<p>tickList は <a href="https://github.com/akashic-games/playlog">https://github.com/akashic-games/playlog</a></p>
<p>startPoints は <a href="https://github.com/akashic-games/amflow">https://github.com/akashic-games/amflow</a></p>
<p>の説明を参照してください。</p>
</div></td>
</tr>
</tbody>
</table>

playId を指定した場合は dynamicPlaylogWorker
と同じくプレーとインスタンスの関連付けを行います。

たとえばプレーAPI GET /plays/:id/instances
でプレーに関連したインスタンスとして取得することができます。

playId と playData
を両方指定した場合も同様に関連付けを行いますが、両者が等価であることはシステムで保証しません。

### code: videoPublisher

ゲームの実行結果を映像配信するモジュール。

インスタンス一つにつき1配信先を登録でき、複数の配信先を登録したい場合は複数のインスタンスにこのモジュールを設定する必要があります。

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>videoPublishUri</td>
<td>String</td>
<td>◯</td>
<td>"rtmp://xxx.yyy.zzz/sample/live/"</td>
<td><p>映像の出力先、RTMP をサポートしています。</p>
<p>指定されなかった場合、コンテンツ側で出力先を指定して映像配信を開始する必要があります。</p></td>
</tr>
<tr class="even">
<td>videoFrameRate</td>
<td>Int</td>
<td><br />
</td>
<td>30</td>
<td>映像のフレームレート (fps)。</td>
</tr>
</tbody>
</table>

### code: eventHandlers

インスタンス上で発生する各種イベントの通知先を指定します。

通知内容については  を参照してください。

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>handlers</td>
<td>Array[Handler]</td>
<td><br />
</td>
<td><br />
</td>
<td><p>イベント通知先を示す Handler の配列</p></td>
</tr>
</tbody>
</table>

#### \#Handler

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>type</td>
<td>String</td>
<td><br />
</td>
<td>"error"</td>
<td><p>イベントの種別。 "instanceStatus", "error", "gameEvent" の３つを指定可能です。</p></td>
</tr>
<tr class="even">
<td>endpoint</td>
<td>String</td>
<td><br />
</td>
<td>"<a href="http://localhost/v1/event">http://localhost/v1/event</a>"</td>
<td><p>イベントの通知先URI を指定します。 POST でリクエストし、 任意の body を送ることが出来ます。</p>
<p>http://example/video/${videoId} のような、 uri を生成することやクエリパラメータの付与は出来ません。</p></td>
</tr>
<tr class="odd">
<td>protocol</td>
<td>String</td>
<td><br />
</td>
<td>"http"</td>
<td>通知プロトコル。 現在は、http のみサポートしています。</td>
</tr>
</tbody>
</table>

### code: akashicEngineParameters

akashic Engine の動作設定を指定する

<table class="wrapped">
<tbody>
<tr class="header">
<th>キー名</th>
<th>型</th>
<th>Nullable</th>
<th>サンプル</th>
<th>概要</th>
</tr>

<tr class="odd">
<td>gameConfigurations</td>
<td>Array[String]</td>
<td>◯ (contentJsonUrl が指定されている場合のみ)</td>
<td>["games/shikabane-jump/1.0/game.json"]</td>
<td><p>ゲーム設定ファイル (game.json) の URL を指定します。</p>
<p>複数の URL を記述した場合、指定した順序でカスケードされます。</p></td>
</tr>
<tr class="even">
<td>contentJsonUrl</td>
<td>String</td>
<td>◯ (gameConfigurations が指定されている場合のみ)</td>
<td>"https://xxx.yyy.zzz/contents/nicocas/2.2.3/content.json"</td>
<td><p>AGV 用の content.json からゲーム設定ファイルを取得する場合に指定します。</p>
<p>このパラメータを設定した場合、gameConfigurations は省略可能です。</p>
<p>contentJsonUrl と gameConfigurations を両方指定した場合、content.json の game.json に gameConfigurations で指定した game.json がカスケードされます。</p></td>
</tr>
<tr class="odd">
<td>args</td>
<td>Object</td>
<td>◯</td>
<td><br />
</td>
<td>ゲームの起動引数</td>
</tr>
<tr class="even">
<td>externals</td>
<td>Array[Object]</td>
<td>◯</td>
<td>
[ { "code": "contentStorage" }, { "code": "logservice" } ]
</td>
<td><div class="content-wrapper">
<p>実行時に有効にしたいプラグインを指定します。</p>
<p>プラグインは全ての環境で利用できるとは限りません。利用する場合は、システム運用者に問い合わせてください。</p>
<p>利用できない環境で指定したとき、インスタンスは異常終了します。</p>
<p>2020/11 現在、配列に指定できる有効な値は以下の通りです。</p>
<ul>
<li><p>{"code": "contentStorage"}</p>
<ul>
<li><p>コンテンツからストレージ機能を利用する。詳細は を参照のこと。</p></li>
<li>これを指定した場合、PlayID が必須になるため、dynamicPlaylogWorker/staticPlaylogWorker の playId が必須となる。指定しない場合は機能が使えない。</li>
</ul></li>
<li>{"code": "logservice"}<br />

<ul>
<li>コンテンツからログ機能を利用する。社内製など trusted なコンテンツでのみ使用することを想定しています。</li>
</ul></li>
</ul>
</div></td>
</tr>
</tbody>
</table>

#### gameConfigurations / contentJsonUrl とインスタンス生成 API のパラメータについて

gameConfigurations 及び contentJsonUrl は実行したいコンテンツのゲーム設定ファイル (game.json) を指定するものです。指定された game.json で下記のように実行環境の情報 (environment フィールド内の akashic-runtime)が設定されている場合、インスタンス生成 API (POST v1.0/instances) の entryPoint パラメータを指定する必要はありません。

```json
{ "environment": { "akashic-runtime": "~1.0.0" } }
```

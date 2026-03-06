# Permission フラグ仕様

## 注意

**このフラグは互換性維持のために残されています。**
新たに利用する場合、[Permission](specification_parameters.md#permission) の `readTick` `subscribeTick` などのフラグを明示的に指定するようにしてください。

## 概要

プレートークンのアクセス権限を示すフラグ文字列について説明する。各フラグはフラグ文字列のsubstring(index, 1)で表される。

## フラグ一覧

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
<th>index</th>
<th>フラグ名</th>
<th>状態</th>
<th>内容</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>0</td>
<td>read</td>
<td>0/1</td>
<td>PlayLogを読み取ることができるフラグ</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>1</td>
<td>write</td>
<td>0/1/2/4</td>
<td><p>PlayLog/Eventを発信することが出来るフラグ<br />
1ならばPlayLogを送出するできる権限を持つ <br />
2ならばPlayer権限でEventを発信することができる<br />
4ならばSubPlayer権限でEventを発信することができる </p></td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>2</td>
<td>eventSubscribe</td>
<td>0/1</td>
<td>イベントを読み取ることができるフラグ</td>
<td><br />
</td>
</tr>
</tbody>
</table>

## フラグ組み合わせ表

<table class="wrapped">
<tbody>
<tr class="header">
<th>フラグ</th>
<th>解説</th>
</tr>

<tr class="odd">
<td>000</td>
<td>権限が何も無いトークン。<br />
基本的にはありえない。 </td>
</tr>
<tr class="even">
<td>100</td>
<td><div class="content-wrapper">
<p>ログを読むことだけができる状態。<br />
リプレイ再生やリアルタイムリプレイ時にこの種別のトークンが発行される。</p>
<p>Permission モデルで readTick, subscribeTick の両方が有効になっている状態と同義。</p>
<p>このとき、インスタンス API のモジュール staticPlaylogWorker はサポートしていないことに注意。</p>
</div></td>
</tr>
<tr class="odd">
<td>010</td>
<td>ログを書き込むことだけができる状態。</td>
</tr>
<tr class="even">
<td>001</td>
<td>イベントを受け取ることがだけできる状態。<br />
複数のクライアントループが対等にメッセージをやり取りするタイプのゲーム(よくあるP2P方式のサーバ経由型)のホスト側にはこの種別のトークンが発行される 。</td>
</tr>
<tr class="odd">
<td>020</td>
<td>プレイヤー権限でイベント(操作要求)を送ることだけができる状態。<br />
フル規格のクラウドゲーミングのプレイヤーにはこの種別のトークンが発行される 。</td>
</tr>
<tr class="even">
<td>040</td>
<td>サブプレイヤー権限でイベント(干渉信号)を送ることだけができる状態。</td>
</tr>
<tr class="odd">
<td>110</td>
<td>ログを読み書きすることができる状態。<br />
現状、これに対応する企画は存在しないが、将来的な利用の可能性は存在する(干渉が無いタイプのクライアントループ)</td>
</tr>
<tr class="even">
<td>101</td>
<td>ログの読み取りと、イベントを受け取ることだけができる状態。<br />
現状、これに対応する企画は存在しないが、将来的な利用の可能性は存在する(モニター用クライアントとか？)</td>
</tr>
<tr class="odd">
<td>120</td>
<td>ログの読み取りと、プレイヤー権限でイベントを送ることができる状態。<br />
サーバループでのプレイヤー、クライアントループのゲストプレイヤーにはこの種別のトークンが発行される。</td>
</tr>
<tr class="even">
<td>140</td>
<td>ログの読み取りと、サブプレイヤー権限でイベントを送ることができる状態。<br />
サーバループでのサブプレイヤー、クライアントループのサブプレイヤーにはこの種別のトークンが発行される 。</td>
</tr>
<tr class="odd">
<td>011</td>
<td>ログの書き込みと、イベントを受け取れる状態。<br />
クライアントループのホストプレイヤー。</td>
</tr>
<tr class="even">
<td>021</td>
<td>イベントの送受信ができる状態。</td>
</tr>
<tr class="odd">
<td>041</td>
<td>サブプレイヤー権限でイベント(干渉信号)を送ることだけができる状態。</td>
</tr>
<tr class="even">
<td>111</td>
<td>ログの読み書きと、イベントを受け取れる状態。<br />
クライアントループのホストプレイヤー(続きからプレイ) 、フルメッシュP2P方式のホスト側。</td>
</tr>
<tr class="odd">
<td>121</td>
<td>ログの読み取りと、プレイヤー権限でのイベントの送受信ができる状態。<br />
フルメッシュP2Pのゲスト側で考えられる。</td>
</tr>
<tr class="even">
<td>141</td>
<td>ログの読み取りと、サブプレイヤー権限でのイベントの送受信ができる状態。<br />
フルメッシュP2Pのゲスト側で考えられる。</td>
</tr>
</tbody>
</table>

## フラグ文字列とPermissionモデル対応表

<table class="wrapped">
<tbody>
<tr class="header">
<th>permission文字列</th>
<th>writeTick</th>
<th>readTick</th>
<th>subscribeTick</th>
<th>sendEvent</th>
<th>subscribeEvent</th>
<th>備考</th>
</tr>

<tr class="odd">
<td>000</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>なにも出来ない</td>
</tr>
<tr class="even">
<td>001</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>010</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>011</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>020</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
<td>※1</td>
</tr>
<tr class="even">
<td>021</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>040</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>041</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>100</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>101</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>110</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>111</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>120</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>121</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
</tr>
<tr class="odd">
<td>140</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
<td><br />
</td>
</tr>
<tr class="even">
<td>141</td>
<td><br />
</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td>◯</td>
<td><br />
</td>
</tr>
</tbody>
</table>

※１

020 と 040
(と021と041)は、イベント送信権限を持つという点は同じだが、送るイベント priority が違う。

020 はプレイヤー権限(2)、040はサブプレイヤー権限(1)
で、020系のほうが priority が高い

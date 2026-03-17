# Play と Playlog について

Play はあるゲームの実行空間を表すリソースです。
Akashic System は、Play ごとのゲームフレーム情報である [Playlog tickList/Start points](https://github.com/akashic-games/playlog) を、ドキュメントデータベースの Playlog Store に永続化しています。

Playlog tickList/Start points は、リプレイ要求や、途中からゲームに参加するときに読み出され、ゲームの状態を再現することができます。

Playlog を保存する Playlog Store は、MongoDB driver を経由して操作できるドキュメントデータベースをバックエンドとして実装されています。
Playlog tick （= ゲームフレーム）というデータ転送・計算負荷が高い情報を扱うため、シンプルな Key & Value 構成としています。

- 実現例：MongoDB, MongoDB driver 互換の FerretDB
- 使用例：Play に紐づく Instance が出力した Playlog 情報の保存と参照

## 構成

ドキュメントデータベース上に以下のコレクション、インデックスを作成します。

| コレクション    | インデックス名   | フィールド          | ユニーク | 用途                           |
| --------------- | ---------------- | ------------------- | -------- | ------------------------------ |
| playlogs        | idx_playId_frame | (playId, frame)     | ✓        | フレーム単位の検索・重複防止   |
| startpoints     | idx_playId_frame | (playId, frame)     | ✓        | スナップショット検索・重複防止 |
| startpoints     | idx_timestamp    | (playId, timestamp) | -        | 時系列検索                     |
| playlogMetadata | idx_playId       | (playId)            | ✓        | メタデータ検索・楽観ロック     |

いずれもアプリケーションの Play リソースの識別子である [playId](/docs/system-api-doc/reference/specification_parameters.md#play) をキーとします。

1. playlogs


    - playId をキーとする
    - frame に対応するエンコード済み Tick データを持つ
    - [AMFlow#getTickList](https://github.com/akashic-games/amflow#getticklist) など、ある playId に紐づく全ての frame データを得るために使われます。

2. startpoints


    - playId をキーとする
    - 開始地点情報の記録
    - [AMFlow#getStartPoint](https://github.com/akashic-games/amflow#getstartpoint) など、指定した frame や timestamp 以前の最も近い開始位置を得るために使われます。

3. playlogMetadata


    - playId をキーとする
    - playlog のメタ情報を管理

## ライフサイクル

Play の状態は [System API reference の プレー状態仕様](/docs/system-api-doc/reference/specification_play_status.md) で定義されています。

Playlog は Play の状態と同期します。ある Play が Close された後は、原則として Playlog が変更されることはありません。

Playlog は終了後もドキュメントデータベースに永続化されるため、たとえば FerretDB(PostgreSQL) のディスク圧迫を招くことがあります。
不要な Playlog は削除する、別のフォーマットでアーカイブしつつ FerretDB からは消す、などの対処はシステム運用者の責務で行ってください。

# playlog-server-engine

playlog-server のコア部分

## SessionControlMessage

[SessionControlMessage モジュール](src/SessionControlMessage.ts)は、以下のような定義と実装を含みます。

- セッションでの操作の種類
- メッセージングする時の（データ構造的的な意味合いの強い）型としてのインターフェース「Packet」の定義
- パケットをプログラム上で扱いやすくするための共通インターフェース「Message」
- 操作の種類 ×(Request, Response) の組み合わせでの、合計 4 通りの「メッセージクラス」
- Packet と Message の相互変換をするユーティリティ

要するに、データの表現と変換 を実装しているということです。
これらは、Session クラス から使用されます。
この SessionControlMessage がライブラリ（道具箱のような意味合い）としての意味合いのに対して、
Session クラスは、 Client - Server 通信の方式の定義をしています。

つまり、OSI 参照モデル的に表現すれば、

- SessionControlMessage モジュールは、プレゼンテーション層
- Session モジュールは、アプリケーション層

にそれぞれ相当するような内容となっています。

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

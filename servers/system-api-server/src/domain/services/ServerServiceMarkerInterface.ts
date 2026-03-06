/**
 * 以下の条件に当てはまるサービスの Marker Interface
 *
 * // 歴史的経緯
 * * もともと別のマイクロサービスとして実装・運用されていた
 * * その後、system-api-server に統合された
 *
 * // 実装の規約
 * * コンストラクタなどの特別なメソッド以外は、 system-control-api-client の各サーバのクライアントと同じインターフェースになっている。
 * * NicoApiResponse などの rest-client-core の層は、剥がしてある。
 */
export default interface ServerServiceMarkerInterface {}

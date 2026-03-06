/**
 * クラスタノード
 */
export const ZNODE_CLUSTERS_NODE = "clusters";
export const ZNODE_CLUSTERS_DISPATCHING_PLAYLOG_SERVER = "dispatching_playlog_server";

/**
 * トレイトノード
 * - 振り分け用の任意のキーワード
 * - 該当ノードを通信プロトコルや特性・制限機能などで振り分けたいこときに使用される要素
 */
export const ZNODE_TRAITS_NODE = "traits";
export const ZNODE_TRAITS_STANDARD_WEBSOCKET = "standard_websocket";
export const ZNODE_TRAITS_STANDARD_LONG_POLLING = "standard_long_polling";
export const ZNODE_TRAITS_FAST_WEBSOCKET = "fast_websocket";
export const ZNODE_TRAITS_FAST_LONG_POLLING = "fast_long_polling";

/**
 * プロセスノード
 */
export const ZNODE_PROCESSES_NODE = "processes";

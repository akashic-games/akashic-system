namespace cpp akashic
namespace d akashic
namespace java akashic
namespace php akashic
namespace perl akashic
namespace csharp akashic
namespace rb akashic
namespace cocoa akashic

// constants
/**
 * プロセスの種別を表す定数
 */
/**
 * プロセス種別gameRunnerを表す定数
 */
const string TYPE_GAME_RUNNER_2 = "gameRunner2"

/**
 * プロセス状態
 */
enum ProcessStatusType {
  /**
   * 正常終了
   * (リプレーの終端時等による自発的終了)
   */
  FINISHED = 0,
  /**
   * インスタンス異常終了
   */
  INSTANCE_CRASHED = 1,
  /**
   * 動画出力停止
   */
  VIDEO_STOPPED = 2,
  /**
   * 無限ループ検知で強制終了
   */
  INFINITY_LOOP_DETECTED = 3,
}

// dataTypes
/**
 * クラスタに参加しているプログラムを識別する値
 */
struct ClusterIdentity {
  /**
   * プログラムが稼働しているマシンのfqdn
   */
  1:string fqdn,
  /**
   * プログラムの種別
   */
  2:string type,
  /**
   * 同じマシン内にいる同一種別のプログラムを区別するためのid等の名前
   */
  3:string name,
  /**
   * zookeeperのczxid
   */
  4:string czxid
}

/**
 * クラスタに参加するための情報
 */
struct ProcessInfo {
  /**
   * クラスタ識別値
   */
  1:ClusterIdentity clusterIdentity,
  /**
   * masterから接続するポート番号
   */
  2:i32 port,
  /**
   * masterに渡すマシン情報JSON string
   */
  3:string machineValues,
}

/**
 * masterへのプロセス状態変化報告用情報
 */
struct ProcessStatusInfo {
  /**
   * 発生したインスタンスのID
   */
  1:string instanceId,
  /**
   * インスタンスの状態
   */
  2:ProcessStatusType type,
  /**
   * メッセージ
   */
  3:string message
}

/**
 * インスタンス稼働時にinjectするモジュール
 */
struct Module {
  /**
   * injectするモジュール名
   */
  1:string code,
  /**
   * モジュールに引き渡す値が入ったJSON string
   */
  2:string values
}

/**
 * インスタンス割り当て情報
 */
struct InstanceAssignment {
  /**
   * 稼働するインスタンスのID
   */
  1:string instanceId,
  /**
   * インスタンスで稼働させるゲームのコード
   */
  2:string gameCode,
  /**
   * インスタンスで稼動させるスクリプトのパス
   */
  4:string entryPoint,
  /**
   * インスタンスにinjectするmodule一覧
   */
  5:list<Module> modules,
  /**
   * インスタンスを稼動させるためのコスト (キャパシティ消費量)
   */
  6:i32 cost,
  /**
   * インスタンスで稼働させるプレイのplayId
   */
  7:string playId,
  /**
   * 最も親のプレイからインスタンスで稼働させるプレイの親プレイまでのplayIdのリスト
   */
  8:list<string> parentPlayIds
}

// error
enum ErrorCode {
  UNKNOWN = 0,
  SYSTEM_ERROR = 1,
  PARAMETER_ERROR = 2, // パラメータエラー
  CLUSTER_ERROR = 3, // クラスタ参加条件を満たしてないエラー
  NOT_FOUND_ERROR = 4, // 対象が見つからないエラー
  NOT_MASTER_ERROR = 5, // masterでないので処理しなかったエラー
  RECHECKING_MASTER_ERROR = 6, // rechecking状態なので処理しなかったエラー(masterに戻る可能性あり)
}
exception RPCError {
  1:ErrorCode errorCode,
  2:string message
}

// service

/**
 * master側が実装し、参加する側が使用するRPCインターフェイス
 */
service Master {
  /**
   * クラスタに参加する
   */
  void join(1:ProcessInfo processInfo) throws (1:RPCError err);
  /**
   * クラスタから離脱する
   */
  void leave(1:ClusterIdentity identity) throws (1:RPCError err);
  /**
   * インスタンス状態変化レポートを送出する
   */
  void reportInstanceStatus(1:ClusterIdentity identity, 2:ProcessStatusInfo status) throws (1:RPCError err);
}

service Process {
  /**
   * インスタンス割り当て
   */
  void assignInstance(1:InstanceAssignment instanceAssignment) throws (1:RPCError err);
  /**
   * インスタンス割り当て解除
   */
  void unassignInstance(1:string instanceId) throws (1:RPCError err);
  /**
   * インスタンス実行一時停止
   */
  void pauseInstance(1:string instanceId) throws (1:RPCError err);
  /**
   * インスタンス実行一時停止解除
   */
  void resumeInstance(1:string instanceId) throws (1:RPCError err);
  /**
   * マスターから渡されるシステム情報(メンテナンスやgraceful shutdown情報等)
   * TODO: 未実装
   */
  // void systemCommand(/*未定*/) throws (1:RPCError err);
}

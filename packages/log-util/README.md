# log-util

サーバサイドのログフォーマットユーティリティ

log4js 経由でサーバサイドアプリログフォーマットのログを出力するためのユーティリティです。

## 使い方

```javascript

import log4js = require("log4js");
import lu = require("@akashic/log-util");

/// log4js の設定をする

// log4js の logger 相当
  var logger: lu.LogUtil = new lu.LogUtil(log4js.getLogger("out"));
  logger.trace("this is trace log.");
  logger.debug("this is debug log.");
  logger.info("this is info log.");
  logger.warn("this is warn log.");
  logger.fatal("this is fatal log.");

  // error と stack trace の出力
  logger.error("exception occurred", error)

// ログに付加情報を追加する
  // constructor で logger に設定
  var logger: lu.LogUtil = new lu.LogUtil(log4js.getLogger("out"), {userId: 4, username: "foo"});
  logger.info("ok"); // '{"message":"ok","userId":4,"username":"foo"}' を出力

  // 後から logger に設定
  logger.setAuxInfo({userId: 2, username: "bar"});
  logger.error("ng"); // '{"message":"ng","userId":2,"username":"bar"}' を出力

  // ログ出力メソッドで設定
  logger.setAuxInfo({});
  logger.warnWithAux("not sure", {userId: 42, username: "baz"});
  // '{"message":"not sure","userId":42,"username":"baz"}' を出力

// start/stop/abort イベントロギング
  // アクション名とログメッセージを指定して使用します。
  // start トリガ用:
  //   traceStart(), debugStart(), infoStart(), warnStart(), errorStart(), fatalStart()
  // end トリガ用:
  //   traceEnd(), debugEnd(), infoEnd(), warnEnd(), errorEnd(), fatalEnd()
  // abort トリガ用:
  //   traceAbort(), debugAbort(), infoAbort(), warnAbort(), errorAbort(), fatalAbort()
  logger.setAuxInfo({});
  logger.infoStart("db_access", "starting %s DB access", "user");
  // '{"message":"starting user DB access","action":"db_access","event":"start"}' を出力
  try {
    ...
    logger.infoEnd("db_access", "DB access finished");
    // '{"message":"DB access finished","action":"db_access","event":"end"}' を出力
  } catch (error) {
    logger.error("DB access failed.", error);
    logger.errorAbort("db_access", "can't access %s DB", "user");
    // '{"message":"can't access user DB","action":"db_access","event":"abort"}' を出力
  }

```

## ライセンス

本リポジトリは MIT License の元で公開されています。
詳しくは [LICENSE](./LICENSE) をご覧ください。

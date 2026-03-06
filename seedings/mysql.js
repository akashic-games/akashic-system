"use strict";
const config = require("config");
const mysql = require("mysql");

async function query(pool, sqlString, values) {
  return new Promise((resolve, reject) => {
    if (values === undefined) {
      pool.query(sqlString, (err, results) => (err ? reject(err) : resolve(results)));
    } else {
      pool.query(sqlString, values, (err, results) => (err ? reject(err) : resolve(results)));
    }
  });
}

module.exports = {};
module.exports.seed = async function seed() {
  // mysqlに接続
  const mysqlConfig = config.get("dbSettings.database.hosts");
  const pool = mysql.createPool({
    host: mysqlConfig[0].host,
    port: mysqlConfig[0].port,
    user: config.get("dbSettings.database.user"),
    password: config.get("dbSettings.database.password"),
    database: config.get("dbSettings.database.database"),
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: "utf8mb4",
    stringifyObjects: true,
  });
  // 初期化処理
  await query(pool, "TRUNCATE TABLE eventHandlers");
  await query(pool, "TRUNCATE TABLE excludedProcesses");
  await query(pool, "TRUNCATE TABLE instanceAssignments");
  await query(pool, "TRUNCATE TABLE instanceEventHandlers");
  await query(pool, "TRUNCATE TABLE instances");
  await query(pool, "TRUNCATE TABLE machines");
  await query(pool, "TRUNCATE TABLE playTokens");
  await query(pool, "TRUNCATE TABLE play_relations");
  await query(pool, "TRUNCATE TABLE plays");
  await query(pool, "TRUNCATE TABLE playsInstances");
  await query(pool, "TRUNCATE TABLE processes");
  await query(pool, "TRUNCATE TABLE reports");
  await query(pool, "TRUNCATE TABLE videoSettings");
  await query(pool, "TRUNCATE TABLE playlogs");
  await query(pool, "TRUNCATE TABLE playsNicoliveMetadata");
};

"use strict";

exports.up = function (db, callback) {
  const sqlString = `
    CREATE TABLE playlogs (
      playId bigint(20) NOT NULL,
      writeStatus varchar(16) NOT NULL,
      PRIMARY KEY (playId),
      KEY writeStatus (writeStatus)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  db.runSql(sqlString, callback);
};

exports.down = function (db) {
  db.dropTable("playlogs", callback);
};

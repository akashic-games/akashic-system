"use strict";

exports.up = function (db, callback) {
  const sqlString = `
    CREATE TABLE playsNicoliveMetadata (
      playId bigint(20) NOT NULL,
      providerType varchar(16) NOT NULL,
      PRIMARY KEY (playId),
      KEY idx_providerType (providerType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  db.runSql(sqlString, callback);
};

exports.down = function (db) {
  db.dropTable("playsNicoliveMetadata", callback);
};

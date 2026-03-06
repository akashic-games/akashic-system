"use strict";

exports.up = function (db, callback) {
  const sqlStringGameCode = `
        CREATE INDEX index_gameCode ON plays (gameCode);
    `;

  const sqlStringStatus = `
        CREATE INDEX index_status ON plays (status);
    `;
  db.runSql(sqlStringGameCode, callback);
  db.runSql(sqlStringStatus, callback);
};

exports.down = function (db) {
  const sqlStringGameCode = `
        DROP INDEX index_gameCode ON plays;
    `;
  const sqlStringStatus = `
        DROP INDEX index_status ON plays;
    `;
  db.runSql(sqlStringGameCode);
  db.runSql(sqlStringStatus);
};

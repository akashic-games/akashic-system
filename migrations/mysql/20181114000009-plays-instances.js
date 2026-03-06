exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE playsInstances (
  playId bigint(20) NOT NULL,
  instanceId bigint(20) NOT NULL,
  PRIMARY KEY (playId,instanceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("playsInstances", callback);
};

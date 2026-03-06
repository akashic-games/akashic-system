exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE playTokens (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  userId bigint(20) NOT NULL,
  playId bigint(20) NOT NULL,
  value varchar(128) NOT NULL,
  expire datetime NOT NULL,
  permission varchar(32) NOT NULL,
  hash varchar(128) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY value (playId,value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("playTokens", callback);
};

exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE instances (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  gameCode varchar(64) NOT NULL,
  status varchar(32) NOT NULL,
  region varchar(32) NOT NULL,
  exitCode int(11) DEFAULT NULL,
  modules mediumtext,
  cost int(11) NOT NULL,
  processName varchar(128) DEFAULT NULL,
  entryPoint varchar(512) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("instances", callback);
};

exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE plays (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  gameCode varchar(64) NOT NULL,
  parentId bigint(20) DEFAULT NULL,
  started datetime NOT NULL,
  finished datetime DEFAULT NULL,
  status varchar(32) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("plays", callback);
};

exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE reports (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  searchKey varchar(32) DEFAULT NULL,
  searchValue varchar(32) DEFAULT NULL,
  createAt datetime DEFAULT NULL,
  value text CHARACTER SET utf8,
  PRIMARY KEY (id),
  KEY idx_search (searchKey,searchValue)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("reports", callback);
};

exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE eventHandlers (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  type varchar(32) NOT NULL,
  endpoint varchar(512) NOT NULL,
  protocol varchar(32) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("eventHandlers", callback);
};

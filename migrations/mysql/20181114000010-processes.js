exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE processes (
  reverseFqdn varchar(255) NOT NULL,
  type varchar(32) NOT NULL,
  name varchar(32) NOT NULL,
  czxid bigint(20) NOT NULL,
  port int(11) NOT NULL,
  machineValues mediumtext,
  PRIMARY KEY (reverseFqdn,type,name,czxid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("processes", callback);
};

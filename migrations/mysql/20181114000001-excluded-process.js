exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE excludedProcesses (
  reverseFqdn varchar(255) NOT NULL DEFAULT "",
  type varchar(32) NOT NULL DEFAULT "",
  name varchar(32) NOT NULL DEFAULT "",
  PRIMARY KEY (reverseFqdn,type,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("excludedProcesses", callback);
};

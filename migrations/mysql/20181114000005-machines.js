exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE machines (
  reverseFqdn varchar(255) NOT NULL,
  agentZxid bigint(20) NOT NULL,
  graphicsType varchar(32) NOT NULL DEFAULT "NONE",
  PRIMARY KEY (reverseFqdn,agentZxid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("machines", callback);
};

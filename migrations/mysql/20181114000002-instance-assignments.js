exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE instanceAssignments (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  reverseFqdn varchar(255) NOT NULL,
  type varchar(32) NOT NULL,
  name varchar(32) NOT NULL,
  czxid bigint(20) NOT NULL,
  instanceId bigint(20) NOT NULL,
  gameCode varchar(64) NOT NULL,
  requirement int(11) NOT NULL,
  targetPort int(11) NOT NULL,
  modules mediumtext,
  entryPoint varchar(512) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_reverseFqdn_type_name_processZxid (reverseFqdn,type,name,czxid),
  KEY idx_instanceId (instanceId),
  KEY idx_gameId_revision (gameCode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("instanceAssignments", callback);
};

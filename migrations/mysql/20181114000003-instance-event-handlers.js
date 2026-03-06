exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE instanceEventHandlers (
  instanceId bigint(20) NOT NULL,
  eventHandlerId bigint(20) NOT NULL,
  PRIMARY KEY (instanceId,eventHandlerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("instanceEventHandlers", callback);
};

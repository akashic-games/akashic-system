exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE videoSettings (
  instanceId bigint(20) NOT NULL,
  videoPublishUri varchar(512) NOT NULL,
  videoFrameRate int(11) NOT NULL,
  PRIMARY KEY (instanceId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("videoSettings", callback);
};

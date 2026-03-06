exports.up = function (db, callback) {
  const sqlString = `
CREATE TABLE play_relations (
  parent_id bigint(20) NOT NULL,
  child_id bigint(20) NOT NULL,
  play_token_permission_boundary blob NOT NULL,
  PRIMARY KEY (parent_id,child_id),
  KEY idx_parent_id (parent_id),
  KEY idx_child_id (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
  db.runSql(sqlString, callback);
};

exports.down = function (db, callback) {
  db.dropTable("play_relations", callback);
};

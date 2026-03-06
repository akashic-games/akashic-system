DROP DATABASE IF EXISTS  __test_tapper;
CREATE DATABASE __test_tapper DEFAULT CHARACTER SET utf8mb4;
USE __test_tapper;
CREATE TABLE test (id BIGINT PRIMARY KEY, foo VARCHAR(64) NOT NULL, bar DOUBLE, baz BIGINT NOT NULL);
INSERT INTO test (id, foo, bar, baz) VALUES(1, "hoge", 1.1, 1);
INSERT INTO test (id, foo, baz) VALUES(2, "fuga", 9223372036854775807);
CREATE TABLE typeTest (
  fBigint BIGINT PRIMARY KEY,
  fTynyint TINYINT,
  fSmallint SMALLINT,
  fMediumint MEDIUMINT,
  fInt INT,
  fsInt INT,
  fnBigint BIGINT,
  fFloat FLOAT,
  fDouble DOUBLE,
  fDate DATE,
  fDatetime DATETIME,
  fsDatetime DATETIME,
  fnDatetime DATETIME,
  fTimestamp TIMESTAMP,
  fTime TIME,
  fYear YEAR,
  fChar CHAR(16),
  fVarchar VARCHAR(16),
  fBinary BINARY(16),
  fVarbinary VARBINARY(16),
  fBlob BLOB,
  fText TEXT,
  fEnum  ENUM('foo', 'bar', 'baz')
);
INSERT INTO typeTest SET
  fBigint = 9223372036854775807,
  fTynyint = 1,
  fSmallint = 32767,
  fMediumint = 8388607,
  fInt = 2147483647,
  fsInt = 2147483647,
  fnBigint = NULL,
  fFloat = 3.14,
  fDouble = 3.14159265358979,
  fDate = "2015/09/01",
  fDatetime = "2015/09/01 12:34:56",
  fsDatetime = "2015/09/01 12:34:56",
  fnDatetime = NULL,
  fTimestamp = "2015/09/01 12:34:56",
  fTime = "22:00:00",
  fYear = 2015,
  fChar = "hoge",
  fVarchar = "fuga",
  fBinary = "piyo",
  fVarbinary = "moyo",
  fBlob = "blob",
  fText = "text",
  fEnum = "baz"
;
CREATE TABLE insertTest (id BIGINT PRIMARY KEY AUTO_INCREMENT, fValue VARCHAR(16) NOT NULL, fUniq BIGINT NOT NULL, UNIQUE(fUniq));

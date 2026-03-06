"use strict";
const mysql = require("./mysql");
const mongodb = require("./mongodb");
const s3 = require("./s3");

Promise.all([mysql.seed(), mongodb.seed(), s3.seed()]).then(() => process.exit());

"use strict";

exports.up = async function (db) {
  await db.createCollection("startpoints");
  await db.collection("startpoints").createIndex({ playId: 1, frame: 1 }, { unique: true, name: "idx_playId_frame" });
  return await db.collection("startpoints").createIndex({ playId: 1, timestamp: 1 }, { unique: false, name: "idx_timestamp" });
};

exports.down = async function (db) {
  return await db.dropCollection("startpoints");
};

exports._meta = {
  version: 1,
};

"use strict";

exports.up = async function (db) {
  await db.createCollection("playlogs");
  return await db.collection("playlogs").createIndex({ playId: 1, frame: 1 }, { unique: true, name: "idx_playId_frame" });
};

exports.down = async function (db) {
  return await db.dropCollection("playlogs");
};

exports._meta = {
  version: 1,
};

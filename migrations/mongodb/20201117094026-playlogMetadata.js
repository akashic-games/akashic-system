"use strict";

exports.up = async function (db) {
  await db.createCollection("playlogMetadata");
  return await db.collection("playlogMetadata").createIndex({ playId: 1 }, { unique: true, name: "idx_playId" });
};

exports.down = async function (db) {
  return await db.dropCollection("playlogMetadata");
};

exports._meta = {
  version: 1,
};

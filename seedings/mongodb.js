"use strict";
const config = require("config");
const { MongoClient } = require("mongodb");

const playlogCollectionName = "playlogs";
const startPointCollectionName = "startpoints";
const metadataCollectionName = "playlogMetadata";

module.exports = {};
module.exports.seed = async function seed() {
  const mongoClient = await MongoClient.connect(config.get("mongodb.url"));
  const mongoDB = mongoClient.db("akashic_test");
  const tickCollection = mongoDB.collection(playlogCollectionName);
  const startPointCollection = mongoDB.collection(startPointCollectionName);
  const metadataCollection = mongoDB.collection(metadataCollectionName);
  await tickCollection.deleteMany({});
  await startPointCollection.deleteMany({});
  await metadataCollection.deleteMany({});
};

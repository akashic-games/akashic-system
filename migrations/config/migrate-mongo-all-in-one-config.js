const path = require("node:path");

const config = {
  mongodb: {
    url: "mongodb://mongodb",
    databaseName: "akashic",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      //   connectTimeoutMS: 3600000, // increase connection timeout to 1 hour
      //   socketTimeoutMS: 3600000, // increase socket timeout to 1 hour
    },
  },

  migrationsDir: path.join("migrations/mongodb"),

  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 0,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs",
};

module.exports = config;

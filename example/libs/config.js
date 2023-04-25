const {
  GeoDataManagerConfiguration,
  GeoDataManager
} = require("dynamodb-geo-v3");
const {ddb} = require ("./ddbClient.js");

const config = new GeoDataManagerConfiguration(ddb, "test1");
config.hashKeyLength = 6;

const geoDataManager = new GeoDataManager(config);

module.exports = {config, geoDataManager};

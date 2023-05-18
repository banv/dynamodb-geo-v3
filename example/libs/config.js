const {
  GeoDataManagerConfiguration,
  GeoDataManager
} = require("@ai-t/dynamodb-geo");
const {ddb} = require ("./ddbClient.js");

const config = new GeoDataManagerConfiguration(ddb, "contents-example");
config.hashKeyLength = 6;
config.parentHashKeyLength = 8;
config.geohashIndexName = 'geohash-index';
config.rangeKeyAttributeName = 'contentId';
config.geohashAttributeName = 'geoHash';
config.parentLevel = 17;

const geoDataManager = new GeoDataManager(config);

module.exports = {config, geoDataManager};

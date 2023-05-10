const {
  GeoDataManagerConfiguration,
  GeoDataManager
} = require("@ait/dynamodb-geo");
const {ddb} = require ("./ddbClient.js");

const config = new GeoDataManagerConfiguration(ddb, "contents");
config.hashKeyLength = 6;
config.geohashIndexName = 'geohash-index';
config.rangeKeyAttributeName = 'contentId';
config.geohashAttributeName = 'geoHash';

const geoDataManager = new GeoDataManager(config);

module.exports = {config, geoDataManager};

const {geoDataManager} = require("./libs/config.js");

return geoDataManager.queryRadius({
  QueryInput: {
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": {"S": "United"}}
  },
  RadiusInMeter: 10000, //10km
  CenterPoint: {
      latitude: 51.51,
      longitude: -0.13
  }
})
.then((locations) => {
  console.log('Locations found: ', locations.length)
  console.log(locations)
});
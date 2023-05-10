const {geoDataManager} = require("./libs/config.js");

return geoDataManager.queryRadius({
  QueryInput: {
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": {"S": "United1"}}
  },
  RadiusInMeter: 10000, //10km
  CenterPoint: {
      latitude: 51.511,
      longitude: -0.13
  }
})
.then((locations) => {
  console.log('Locations found: ', locations.length)
  console.log(locations)
});
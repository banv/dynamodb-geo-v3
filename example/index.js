const serverless = require('serverless-http');
const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3002
const bodyParser = require('body-parser')

const {geoDataManager} = require("./libs/config.js");

// Configure middleware
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.post('/post', function (req, res) {
  if (!req.body.lat || !req.body.lng) return res.status(422).send('Missing parameters')

  console.log(`Called with ${req.body}`)
  geoDataManager.queryRadius({
    QueryInput: {
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": {"S": req.body.userId}}
    },
    RadiusInMeter: req.body.radius,
    CenterPoint: {
        latitude: req.body.lat,
        longitude: req.body.lng
    }
  })
  .then((locations) => {
    console.log('Locations found: ', locations.length)
    res.send(locations)
  })  
})

// if running locally
if (!process.env.PORT) {
  app.listen(port, () => console.log(`DEV MODE: listening on ${port}`))
}

module.exports.handler = serverless(app)
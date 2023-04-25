const {
  GeoTableUtil,
} = require("dynamodb-geo-v3");
const {
  waitUntilTableExists,
} = require("@aws-sdk/client-dynamodb");
const uuid = require("uuid");

const {config, geoDataManager} = require("./libs/config.js");

const {ddb, ddbClient} = require("./libs/ddbClient.js");

// Use GeoTableUtil to help construct a CreateTableInput.
const createTableInput = GeoTableUtil.getCreateTableRequest(config);

// Tweak the schema as desired
createTableInput.ProvisionedThroughput.ReadCapacityUnits = 2;

console.log("Creating table with schema:");
console.dir(createTableInput, { depth: null });

// Create the table
ddb
  .createTable(createTableInput)
  // Wait for it to become ready
  .then(function () {
    return waitUntilTableExists(
      { client: ddbClient, maxWaitTime: 30000 },
      { TableName: config.tableName }
    );
  })
  // Load sample data in batches
  .then(function () {
    console.log("Loading sample data from capitals.json");
    const data = require("./capitals.json");
    const putPointInputs = data.map(function (capital) {
      return {
        RangeKeyValue: { S: uuid.v4() }, // Use this to ensure uniqueness of the hash/range pairs.
        GeoPoint: {
          latitude: capital.latitude,
          longitude: capital.longitude,
        },
        PutItemInput: {
          Item: {
            country: { S: capital.country },
            capital: { S: capital.capital },
          },
        },
        CompositeValues: ['user1']
      };
    });

    const BATCH_SIZE = 25;
    const WAIT_BETWEEN_BATCHES_MS = 1000;
    let currentBatch = 1;

    function resumeWriting() {
      if (putPointInputs.length === 0) {
        return Promise.resolve();
      }
      const thisBatch = [];
      for (
        let i = 0, itemToAdd = null;
        i < BATCH_SIZE && (itemToAdd = putPointInputs.shift());
        i++
      ) {
        thisBatch.push(itemToAdd);
      }
      console.log(
        "Writing batch " +
          currentBatch++ +
          "/" +
          Math.ceil(data.length / BATCH_SIZE)
      );
      return geoDataManager
        .batchWritePoints(thisBatch)
        .then(function () {
          return new Promise(function (resolve) {
            setInterval(resolve, WAIT_BETWEEN_BATCHES_MS);
          });
        })
        .then(function () {
          return resumeWriting();
        });
    }

    return resumeWriting().catch(function (error) {
      console.warn(error);
    });
  })
  // Perform a radius query
  .then(function () {
    console.log("Querying by radius, looking 100km from Cambridge, UK.");
    return geoDataManager.queryRadius({
      RadiusInMeter: 100000,
      CenterPoint: {
        latitude: 52.22573,
        longitude: 0.149593,
      },
      CompositeValues: ['user1']
    });
  })
  // Print the results, an array of DynamoDB.AttributeMaps
  .then(console.log)
  // Clean up
  .then(function () {
    return ddb.deleteTable({ TableName: config.tableName });
  })
  .catch(console.warn)
  .then(function () {
    process.exit(0);
  });

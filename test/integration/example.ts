import * as ddbGeo from "../../src";
import {
  DynamoDB,
  DynamoDBClient,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { expect } from "chai";

type Capital = {
  country: string;
  capital: string;
  latitude: number;
  longitude: number;
};

describe("Example", function () {
  // Use a local DB for the example.
  const ddb = new DynamoDB({
    credentials: {
      accessKeyId: "dummy",
      secretAccessKey: "dummy",
    },
    endpoint: "http://127.0.0.1:8000",
    region: "eu-west-1",
  });
  const ddbClient = new DynamoDBClient({
    credentials: {
      accessKeyId: "dummy",
      secretAccessKey: "dummy",
    },
    endpoint: "http://127.0.0.1:8000",
    region: "eu-west-1",
  });

  // Configuration for a new instance of a GeoDataManager. Each GeoDataManager instance represents a table
  const config = new ddbGeo.GeoDataManagerConfiguration(ddb, "test-capitals");

  // Instantiate the table manager
  const capitalsManager = new ddbGeo.GeoDataManager(config);

  before(async function () {
    this.timeout(20000);
    config.hashKeyLength = 3;
    config.consistentRead = true;
    config.parentLevel = 17;

    // Use GeoTableUtil to help construct a CreateTableInput.
    const createTableInput = ddbGeo.GeoTableUtil.getCreateTableRequest(config);
    createTableInput.ProvisionedThroughput.ReadCapacityUnits = 2;
    await ddb.createTable(createTableInput);
    // Wait for it to become ready
    await waitUntilTableExists(
      { client: ddbClient, maxWaitTime: 30000 },
      { TableName: config.tableName }
    );
    // Load sample data in batches

    console.log("Loading sample data from capitals.json");
    const data: Capital[] = require("./capitals.json");
    const putPointInputs = data.map((capital, i) => ({
      RangeKeyValue: { S: String(i) }, // Use this to ensure uniqueness of the hash/range pairs.
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
    }));

    const BATCH_SIZE = 25;
    const WAIT_BETWEEN_BATCHES_MS = 1000;
    let currentBatch = 1;

    async function resumeWriting() {
      if (putPointInputs.length === 0) {
        console.log("Finished loading");
        return;
      }
      const thisBatch = [];
      for (
        var i = 0, itemToAdd = null;
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
      await capitalsManager.batchWritePoints(thisBatch);
      // Sleep
      await new Promise((resolve) =>
        setInterval(resolve, WAIT_BETWEEN_BATCHES_MS)
      );
      return resumeWriting();
    }
    return resumeWriting();
  });

  it("queryRadius", async function () {
    this.timeout(20000);
    // Perform a radius query
    const result = await capitalsManager.queryRadius({
      RadiusInMeter: 100000,
      CenterPoint: {
        latitude: 52.22573,
        longitude: 0.149593,
      },
    });

    console.log('result', result);


    expect(result).to.deep.equal([
      {
        rangeKey: { S: "50" },
        country: { S: "United Kingdom" },
        capital: { S: "London" },
        hashKey: { N: "522" },
        geoJson: { S: '{"type":"Point","coordinates":[-0.13,51.51]}' },
        geohash: { N: "5221366118452580119" },
        distance: { N: "81816.50009025329" },
        parentHash: { N: '5221366118442074112' },
        parentGeoJson: {
          S: '{"type":"Point","coordinates":[-0.13028320135503882,51.51000781675613]}'
        },

      },
    ]);
  });

  after(async function () {
    this.timeout(10000);
    await ddb.deleteTable({ TableName: config.tableName });
  });
});

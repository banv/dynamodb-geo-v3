// Create service client module using ES6 syntax.
const {DynamoDB, DynamoDBClient} = require("@aws-sdk/client-dynamodb");
// Create an Amazon DynamoDB service client object.
const ddbClient = new DynamoDBClient({ credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  endpoint: "http://localhost:8000",
  region: 'ap-northeast-1',
});

const ddb = new DynamoDB({
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  endpoint: "http://localhost:8000",
  region: 'ap-northeast-1',
});

module.exports = { ddb, ddbClient };

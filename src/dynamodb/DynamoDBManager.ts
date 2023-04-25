/*
 * Copyright 2010-2013 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import {
  AttributeValue,
  Condition,
  PutItemInput,
  PutRequest,
  QueryInput,
  QueryOutput,
  WriteRequest,
} from "@aws-sdk/client-dynamodb";
import * as Long from "long";
import { GeoDataManagerConfiguration } from "../GeoDataManagerConfiguration";
import {
  DeletePointInput,
  GetPointInput,
  Item,
  PutPointInput,
  UpdatePointInput,
} from "../types";
import { S2Manager } from "../s2/S2Manager";
import { GeohashRange } from "../model/GeohashRange";

export class DynamoDBManager {
  private config: GeoDataManagerConfiguration;

  public constructor(config: GeoDataManagerConfiguration) {
    this.config = config;
  }

  /**
   * Query Amazon DynamoDB
   *
   * @param queryInput
   * @param hashKey
   *            Hash key for the query request.
   *
   * @param range
   *            The range of geohashs to query.
   * @param compositeValues
   *            Composite values to query.
   * @return The query result.
   */
  public async queryGeohash(
    queryInput: QueryInput | undefined,
    hashKey: Long,
    range: GeohashRange,
    compositeValues: string[] | undefined,
  ) {
    const queryOutputs: QueryOutput[] = [];

    const nextQuery = async (lastEvaluatedKey: Item = null) => {
      const keyConditions: { [key: string]: Condition } = {};

      keyConditions[this.config.hashKeyAttributeName] = {
        ComparisonOperator: "EQ",
        AttributeValueList: [{ S: this.getCompositeHashKey(hashKey, compositeValues)}],
      };

      const minRange: AttributeValue = { N: range.rangeMin.toString(10) };
      const maxRange: AttributeValue = { N: range.rangeMax.toString(10) };

      keyConditions[this.config.geohashAttributeName] = {
        ComparisonOperator: "BETWEEN",
        AttributeValueList: [minRange, maxRange],
      };

      const defaults = {
        TableName: this.config.tableName,
        KeyConditions: keyConditions,
        IndexName: this.config.geohashIndexName,
        ConsistentRead: this.config.consistentRead,
        ReturnConsumedCapacity: "TOTAL",
        ExclusiveStartKey: lastEvaluatedKey,
      };

      const queryOutput = await this.config.dynamoDBClient.query({
        ...defaults,
        ...queryInput,
      });
      queryOutputs.push(queryOutput);
      if (queryOutput.LastEvaluatedKey) {
        return nextQuery(queryOutput.LastEvaluatedKey);
      }
    };

    await nextQuery();
    return queryOutputs;
  }

  public getPoint(getPointInput: GetPointInput) {
    const geohash = S2Manager.generateGeohash(getPointInput.GeoPoint);
    const hashKey = S2Manager.generateHashKey(
      geohash,
      this.config.hashKeyLength
    );

    const getItemInput = getPointInput.GetItemInput;
    getItemInput.TableName = this.config.tableName;

    getItemInput.Key = {
      [this.config.hashKeyAttributeName]: { N: hashKey.toString(10) },
      [this.config.rangeKeyAttributeName]: getPointInput.RangeKeyValue,
    };

    return this.config.dynamoDBClient.getItem(getItemInput);
  }

  public putPoint(putPointInput: PutPointInput) {
    const geohash = S2Manager.generateGeohash(putPointInput.GeoPoint);
    const hashKey = S2Manager.generateHashKey(
      geohash,
      this.config.hashKeyLength
    );
    const putItemInput: PutItemInput = {
      ...putPointInput.PutItemInput,
      TableName: this.config.tableName,
      Item: putPointInput.PutItemInput.Item || {},
    };

    putItemInput.Item[this.config.hashKeyAttributeName] = {
      S: this.getCompositeHashKey(hashKey, putPointInput.CompositeValues),
    };
    putItemInput.Item[this.config.rangeKeyAttributeName] =
      putPointInput.RangeKeyValue;
    putItemInput.Item[this.config.geohashAttributeName] = {
      N: geohash.toString(10),
    };
    putItemInput.Item[this.config.geoJsonAttributeName] = {
      S: JSON.stringify({
        type: this.config.geoJsonPointType,
        coordinates: this.config.longitudeFirst
          ? [putPointInput.GeoPoint.longitude, putPointInput.GeoPoint.latitude]
          : [putPointInput.GeoPoint.latitude, putPointInput.GeoPoint.longitude],
      }),
    };

    return this.config.dynamoDBClient.putItem(putItemInput);
  }

  public batchWritePoints(putPointInputs: PutPointInput[]) {
    const writeInputs: WriteRequest[] = [];
    putPointInputs.forEach((putPointInput) => {
      const geohash = S2Manager.generateGeohash(putPointInput.GeoPoint);
      const hashKey = S2Manager.generateHashKey(
        geohash,
        this.config.hashKeyLength
      );
      const putItemInput = putPointInput.PutItemInput;

      const putRequest: PutRequest = {
        Item: putItemInput.Item || {},
      };

      putRequest.Item[this.config.hashKeyAttributeName] = {
        S: this.getCompositeHashKey(hashKey, putPointInput.CompositeValues),
      };
      putRequest.Item[this.config.rangeKeyAttributeName] =
        putPointInput.RangeKeyValue;
      putRequest.Item[this.config.geohashAttributeName] = {
        N: geohash.toString(10),
      };
      putRequest.Item[this.config.geoJsonAttributeName] = {
        S: JSON.stringify({
          type: this.config.geoJsonPointType,
          coordinates: this.config.longitudeFirst
            ? [
                putPointInput.GeoPoint.longitude,
                putPointInput.GeoPoint.latitude,
              ]
            : [
                putPointInput.GeoPoint.latitude,
                putPointInput.GeoPoint.longitude,
              ],
        }),
      };

      writeInputs.push({ PutRequest: putRequest });
    });

    return this.config.dynamoDBClient.batchWriteItem({
      RequestItems: {
        [this.config.tableName]: writeInputs,
      },
    });
  }

  public updatePoint(updatePointInput: UpdatePointInput) {
    const geohash = S2Manager.generateGeohash(updatePointInput.GeoPoint);
    const hashKey = S2Manager.generateHashKey(
      geohash,
      this.config.hashKeyLength
    );

    updatePointInput.UpdateItemInput.TableName = this.config.tableName;

    if (!updatePointInput.UpdateItemInput.Key) {
      updatePointInput.UpdateItemInput.Key = {};
    }

    updatePointInput.UpdateItemInput.Key[this.config.hashKeyAttributeName] = {
      S: this.getCompositeHashKey(hashKey, updatePointInput.CompositeValues),
    };
    updatePointInput.UpdateItemInput.Key[this.config.rangeKeyAttributeName] =
      updatePointInput.RangeKeyValue;

    // Geohash and geoJson cannot be updated.
    if (updatePointInput.UpdateItemInput.AttributeUpdates) {
      delete updatePointInput.UpdateItemInput.AttributeUpdates[
        this.config.geohashAttributeName
      ];
      delete updatePointInput.UpdateItemInput.AttributeUpdates[
        this.config.geoJsonAttributeName
      ];
    }

    return this.config.dynamoDBClient.updateItem(
      updatePointInput.UpdateItemInput
    );
  }

  public deletePoint(deletePointInput: DeletePointInput) {
    const geohash = S2Manager.generateGeohash(deletePointInput.GeoPoint);
    const hashKey = S2Manager.generateHashKey(
      geohash,
      this.config.hashKeyLength
    );

    return this.config.dynamoDBClient.deleteItem({
      ...deletePointInput.DeleteItemInput,
      TableName: this.config.tableName,
      Key: {
        [this.config.hashKeyAttributeName]: { S: this.getCompositeHashKey(hashKey, deletePointInput.CompositeValues) },
        [this.config.rangeKeyAttributeName]: deletePointInput.RangeKeyValue,
      },
    });
  }

  protected getCompositeHashKey(hashKey: Long, compositeValues: string[]): string {
    let compositeHashKey = hashKey.toString(10);
    if (!compositeValues || compositeValues.length === 0) {
      return compositeHashKey;
    }
    for(const compositeValue of compositeValues) {
      compositeHashKey += "_" + compositeValue;
    }
    return compositeHashKey;
  }
}

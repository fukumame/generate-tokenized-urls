#!/usr/bin/env node
console.log("Running Conversion");

const AWS = require("aws-sdk");
require('dotenv').config();
const fs = require("fs");
const jwt = require("jsonwebtoken");
const s3 = new AWS.S3({region: process.env.AWS_REGION});
const args = require("yargs")
  .option("bucket", {
    alias: "b",
    describe: "URL of AWS bucket"
  })
  .option("host", {
    alias: "h",
    describe: "URL hosting the flask proxy"
  })
  .option("output", {
    alias: "o",
    describe: "Filepath to output result"
  })
  .option("prefix", {
    alias: "p",
    describe: "Limits the response to keys that begin with the specified prefix.",
    default: ""
  })
  .demandOption(["bucket", "host", "output"])
  .help().argv;

const mapToUrl = ({ key, bucket, externalId }) => {
  const encoded = jwt.sign({ key, bucket }, process.env.JWT_SECRET, {
    expiresIn: "100y"
  });

  return { externalId, imageUrl: `${args.host}?token=${encoded}` };
};

const generateKeyBucketPairs = async (bucket, prefix) => {
  const params = {
    Bucket: bucket,
    Prefix: prefix
  };
  let content = [];
  const gatherUrlsFromBucket = new Promise((resolve, reject) => {
    s3.listObjectsV2(params).eachPage((err, data, done) => {
      if (err) {
        reject(err);
      }
      if (data) {
        dataContents = data.Contents.filter(({Key}) => Key.match(/(\.png|\.jpg|\.jpeg|\.tiff|\.gif)/));
        content = [
          ...content,
          ...dataContents.map(({ Key }) => ({
            key: Key,
            bucket,
            externalId: Key
          }))
        ];
      }
      if (data === null) {
        const urls = content.map(mapToUrl);
        resolve(urls);
      }
      done();
    });
  });

  return await gatherUrlsFromBucket;
};

const writeToOutput = async () => {
  const json = await generateKeyBucketPairs(args.bucket, args.prefix);

  const splitSize = 5000;
  let startIndex = 0;

  const baseFileName = args.output.split(".")[0];

  while(true){
    const splitJson = json.slice(startIndex, startIndex + splitSize);

    if (splitJson.length === 0){
      break
    }

    const fileName = `${baseFileName}_${startIndex}.json`;
    fs.writeFile(fileName, JSON.stringify(splitJson), err => {
      if (err) {
        throw err;
      }
      console.log(`${fileName} has been saved`);
    });
    startIndex += splitSize;

  }

};

writeToOutput();

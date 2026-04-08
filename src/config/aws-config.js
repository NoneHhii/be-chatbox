require('dotenv').config();
const aws = require('aws-sdk');

aws.config.update({
    region: process.env.region,
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
});

const s3 = new aws.S3();

module.exports = s3;
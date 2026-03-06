"use strict";
const config = require("config");
const aws = require("@aws-sdk/client-s3");

module.exports = {};
module.exports.seed = async function seed() {
  // s3に接続
  const { accessKeyId, secretAccessKey, ...rest } = config.get("s3");
  const s3 = new aws.S3Client({
    region: "ap-northeast-1",
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    ...rest,
    forcePathStyle: true,
  });

  await s3.send(new aws.CreateBucketCommand({ Bucket: "akashic-test" })).catch(() => {
    /* createIfNotExistsが無いので、、、 */
  });

  // バケットのオブジェクトを全削除
  let listObjectResult = null;
  while (!listObjectResult || listObjectResult.IsTruncated) {
    listObjectResult = await s3.send(new aws.ListObjectsCommand({ Bucket: "akashic-test" }));
    if (!listObjectResult.Contents) {
      break;
    }

    const objects = listObjectResult.Contents.map((obj) => ({ Key: obj.Key ? obj.Key : "" })).filter((obj) => obj.Key !== "");
    if (objects.length === 0) {
      break;
    }

    await s3.send(
      new aws.DeleteObjectsCommand({
        Bucket: "akashic-test",
        Delete: {
          Objects: objects,
        },
      }),
    );
  }
};

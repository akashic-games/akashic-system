import config from "config";
import { CreateBucketCommand, ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

function log(message: string): void {
	console.log(message);
}

async function main(): Promise<boolean> {
	// 作るべきバケットの一覧
	const expectBucketNames: string[] = [config.get<string>("archiveSettings.bucket")];

	const s3 = new S3Client({
		endpoint: config.get("s3.endpoint"),
		credentials: {
			accessKeyId: config.get("s3.accessKeyId"),
			secretAccessKey: config.get("s3.secretAccessKey"),
		},
		region: "ap-northeast-1",
		forcePathStyle: true,
	});
	// すでに存在しているバケットの一覧
	const existsBucketNames: (string | undefined)[] = (await s3.send(new ListBucketsCommand())).Buckets?.map((bucket) => bucket.Name) ?? [];

	// 作るべきバケットのうち、まだ存在していないものを作る
	const createBucketArray = expectBucketNames
		.filter((value) => !existsBucketNames.includes(value)) // すでに存在するバケットは作らないので除く
		.map((value) => s3.send(new CreateBucketCommand({ Bucket: value })));
	log(`create bucket count: ${createBucketArray.length.toString(10)}`);
	return Promise.allSettled(createBucketArray).then((value) => value.every((value1) => value1.status === "fulfilled"));
}

main().then((status) => (status ? process.exit() : process.exit(1)));

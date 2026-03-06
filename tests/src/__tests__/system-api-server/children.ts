import { SystemApiClient } from "@akashic/system-api-client";

import config from "config";

function getEndpoint(): string {
	return config.get("endpoints.system-api-server");
}

// 親プレーのトークンで子プレーも認証できる という機能の文脈で出てくる play children。
describe("play children API", () => {
	test("happy path", async () => {
		const gameCode: string = "game_code_for_children_0";
		const client = new SystemApiClient(getEndpoint());

		// 親と子のプレイを作る
		const resultCreatedParentPlay = await client.createPlay(gameCode);
		const resultCreatedChildPlay = await client.createPlay(gameCode);
		const parentPlayID = resultCreatedParentPlay.data!.id;
		const childPlayID = resultCreatedChildPlay.data!.id;

		// 親子関係を作る
		const resultCreatedPlayRelation = await client.createPlayChildren(parentPlayID, childPlayID);
		expect(resultCreatedPlayRelation.meta.status).toBe(200);
		expect(resultCreatedPlayRelation.data).toBeUndefined();

		// getPlay で取れる parentID は、play テーブルにある parent_id なのだけれど、
		// これはトークンの認証の文脈で出てきたプレーの親子関係ではなく、
		// 派生プレーという概念ができる少し前にとりあえずで作られたカラム。
		// 何にも使用されていないデータ。
		// このカラムに なにかデータを INSERT / UPDATE するパスは存在しない。
		// 常に null を返す。
		const resultGotChildPlay = await client.getPlay(childPlayID);
		expect(resultGotChildPlay.data!.parentId).toBe(null);

		// 親子関係を消す
		const resultDeletedPlayRelation = await client.deletePlayChildren(parentPlayID, childPlayID);
		expect(resultDeletedPlayRelation.meta.status).toBe(200);
		expect(resultDeletedPlayRelation.data).toBeUndefined();
	});
});

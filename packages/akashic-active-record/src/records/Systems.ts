import { Annotations } from "@akashic/tapper";

/**
 * 件数のカウント情報取得用record
 * SELECT COUNT(*) as count FROM...というクエリで使用
 */
export class Count {
	@Annotations.map()
	public count: string;
}

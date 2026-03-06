import * as Cast from "@akashic/cast-util";
import { Report as ReportDataType } from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

/**
 * レポート情報へのパッチ
 */
export interface ReportPatch {
	/**
	 * レポートID
	 */
	id?: string;
	/**
	 * 検索キー
	 */
	searchKey: string;
	/**
	 * 検索キーに対応する値
	 */
	searchValue: string;
	/**
	 * 作成日時
	 */
	createdAt?: Date;
	/**
	 * レポート値
	 */
	value: string;
}

/**
 * レポート情報
 */
export class Report {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: ReportPatch): Report {
		const result = new Report();
		result.id = Cast.bigint(entity.id, true);
		result.searchKey = Cast.string(entity.searchKey, 32);
		result.searchValue = Cast.string(entity.searchValue, 32);
		result.createdAt = Cast.date(entity.createdAt, true);
		result.value = Cast.string(entity.value, 65535);
		return result;
	}
	@Annotations.map()
	public id: string;

	@Annotations.map()
	public searchKey: string;

	@Annotations.map()
	public searchValue: string;

	@Annotations.map()
	public createdAt: Date;

	@Annotations.map()
	public value: string;

	public toEntity(): ReportDataType {
		return new ReportDataType({
			id: this.id,
			searchKey: this.searchKey,
			searchValue: this.searchValue,
			createdAt: this.createdAt,
			value: this.value,
		});
	}
}

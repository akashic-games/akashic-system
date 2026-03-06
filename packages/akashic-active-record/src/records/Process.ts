import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";
import * as ciMapper from "../repositories/mappers/ClusterIdentityMapper";

/**
 * プロセス情報へのパッチ
 */
export interface ProcessPatch {
	/**
	 * プロセスのIdentity
	 */
	clusterIdentity?: dt.ClusterIdentity;
	/**
	 * プロセスのポート番号
	 */
	port?: number;
	/**
	 * プロセスの各種情報
	 */
	machineValues?: object;
}

/**
 * プロセス情報
 */
export class Process {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: ProcessPatch): Process {
		const result = new Process();
		if (entity.clusterIdentity) {
			result.reverseFqdn = Cast.string(entity.clusterIdentity.fqdn.toReverseFQDN(), 255);
			result.type = Cast.string(entity.clusterIdentity.type, 32);
			result.name = Cast.string(entity.clusterIdentity.name, 32);
			result.czxid = Cast.bigint(entity.clusterIdentity.czxid);
		}
		result.port = Cast.int(entity.port, true);
		result.machineValues = entity.machineValues ? JSON.stringify(entity.machineValues) : undefined;
		return result;
	}
	/**
	 * マシンのFQDN逆順
	 */
	@Annotations.map()
	public reverseFqdn: string;
	/**
	 * 種別
	 */
	@Annotations.map()
	public type: string;
	/**
	 * 名称
	 */
	@Annotations.map()
	public name: string;
	/**
	 * プロセスのzookeeper上のznodeのczxid
	 */
	@Annotations.map()
	public czxid: string;
	/**
	 * プロセスのポート番号
	 */
	@Annotations.map()
	public port: number;
	/**
	 * プロセスの各種情報
	 */
	public machineValues: string;

	public toEntity(): dt.Process {
		let machineValues: any = {};
		try {
			machineValues = JSON.parse(this.machineValues);
		} catch (e) {
			// パース失敗時は何もしない
		}
		return new dt.Process({
			clusterIdentity: ciMapper.recordToEntity({
				reverseFqdn: this.reverseFqdn,
				type: this.type,
				name: this.name,
				czxid: this.czxid,
			}),
			port: this.port,
			machineValues,
		});
	}
}

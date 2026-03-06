import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";
import * as ciMapper from "../repositories/mappers/ClusterIdentityMapper";

/**
 * インスタンス情報へのパッチ
 */
export interface InstanceAssignmentPatch {
	/**
	 * ID
	 */
	id?: string;
	/**
	 * 割り当てられたターゲット
	 */
	targetIdentity?: dt.ClusterIdentity;
	/**
	 * 割り当てらてたターゲットの待ち受けポート
	 */
	targetPort?: number;
	/**
	 * 割り当てられたインスタンスのID
	 */
	instanceId?: string;
	/**
	 * 割り当てられたゲームのコード
	 */
	gameCode?: string;
	/**
	 * 実行スクリプトのパス
	 */
	entryPoint?: string;
	/**
	 * 割り当て量
	 */
	requirement?: number;
	/**
	 * 割り当てられたゲームのモジュール情報BLOB
	 */
	modules?: object;
}
/**
 * インスタンス割り当て情報
 */
export class InstanceAssignment {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: InstanceAssignmentPatch): InstanceAssignment {
		const result = new InstanceAssignment();
		result.id = Cast.bigint(entity.id, true);
		if (entity.targetIdentity) {
			result.reverseFqdn = Cast.string(entity.targetIdentity.fqdn.toReverseFQDN(), 255);
			result.type = Cast.string(entity.targetIdentity.type, 32);
			result.name = Cast.string(entity.targetIdentity.name, 32);
			result.czxid = Cast.bigint(entity.targetIdentity.czxid);
		}
		result.targetPort = Cast.int(entity.targetPort, true);
		result.instanceId = Cast.bigint(entity.instanceId, true);
		result.gameCode = Cast.string(entity.gameCode, 64, true);
		result.entryPoint = Cast.string(entity.entryPoint, 512, true);
		result.requirement = Cast.int(entity.requirement, true);
		result.modules = entity.modules ? JSON.stringify(entity.modules) : undefined;
		return result;
	}
	/**
	 * ID
	 */
	@Annotations.map()
	public id: string;
	/**
	 * プロセスが存在するマシンのFQDN逆順
	 */
	@Annotations.map()
	public reverseFqdn: string;
	/**
	 * プロセス種別
	 */
	@Annotations.map()
	public type: string;
	/**
	 * プロセス名
	 */
	@Annotations.map()
	public name: string;
	/**
	 * プロセスのzookeeper上のznodeのczxid
	 */
	@Annotations.map()
	public czxid: string;
	/**
	 * プロセスの待ち受けポート
	 */
	@Annotations.map()
	public targetPort: number;
	/**
	 * 割り当てられたインスタンスのID
	 */
	@Annotations.map()
	public instanceId: string;
	/**
	 * 割り当てられたゲームのコード
	 */
	@Annotations.map()
	public gameCode: string;
	/**
	 * 実行スクリプトのパス
	 */
	@Annotations.map()
	public entryPoint: string;
	/**
	 * 割り当て量
	 */
	@Annotations.map()
	public requirement: number;
	/**
	 * 割り当てられたゲームのモジュール情報BLOB
	 */
	@Annotations.map()
	public modules: string;

	public toEntity(): dt.InstanceAssignment {
		const modules: dt.InstanceModuleLike[] = [];
		let parsedModules: any[] = [];
		try {
			parsedModules = JSON.parse(this.modules);
		} catch (e) {
			// パースに失敗したらmodule無しとみなす
		}
		parsedModules.forEach((parsedModule) => {
			if (parsedModule && typeof parsedModule.moduleCode === "string") {
				modules.push(parsedModule);
			}
		});
		return new dt.InstanceAssignment({
			id: this.id,
			targetIdentity: ciMapper.recordToEntity({
				reverseFqdn: this.reverseFqdn,
				type: this.type,
				name: this.name,
				czxid: this.czxid,
			}),
			targetPort: this.targetPort,
			gameCode: this.gameCode,
			instanceId: this.instanceId,
			entryPoint: this.entryPoint,
			requirement: this.requirement,
			modules,
		});
	}
}

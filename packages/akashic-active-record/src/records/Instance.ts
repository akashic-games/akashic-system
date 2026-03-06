import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

/**
 * インスタンス情報へのパッチ
 */
export interface InstancePatch {
	/**
	 * ID
	 */
	id?: string;
	/**
	 * 起動するゲーム
	 */
	gameCode?: string;
	/**
	 * 動作モード
	 */
	modules?: dt.InstanceModule[];
	/**
	 * インスタンスの状態
	 */
	status?: string;
	/**
	 * インスタンスの稼働先
	 */
	region?: string;
	/**
	 * 終了コード
	 */
	exitCode?: number;
	/**
	 * 割り当てコスト
	 */
	cost?: number;
	/**
	 * インスタンス稼働先のプロセス(game-runner)の識別子
	 */
	processName?: string;
	/**
	 * 実行する js ファイルのパス
	 */
	entryPoint?: string;
}
/**
 * インスタンス情報
 */
export class Instance {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: InstancePatch): Instance {
		const result = new Instance();
		result.id = Cast.bigint(entity.id, true);
		result.gameCode = Cast.string(entity.gameCode, 64);
		result.modules = entity.modules ? JSON.stringify(entity.modules) : undefined;
		result.status = Cast.string(entity.status, 32);
		result.region = Cast.string(entity.region, 32);
		result.exitCode = Cast.int(entity.exitCode, true);
		result.cost = Cast.int(entity.cost);
		result.processName = Cast.string(entity.processName, 128, true);
		result.entryPoint = Cast.string(entity.entryPoint, 512);
		return result;
	}
	/**
	 * ID
	 */
	@Annotations.map()
	public id: string;
	/**
	 * 起動するゲームID
	 */
	@Annotations.map()
	public gameCode: string;
	/**
	 * 起動時に指定したmodule一覧を、DBに保存するためにjsonで格納した物
	 */
	@Annotations.map()
	public modules: string;
	/**
	 * インスタンスの状態
	 */
	@Annotations.map()
	public status: string;
	/**
	 * インスタンスの稼働先
	 */
	@Annotations.map()
	public region: string;
	/**
	 * 終了コード
	 */
	@Annotations.map()
	public exitCode: number;
	/**
	 * 割り当てコスト
	 */
	@Annotations.map()
	public cost: number;
	/**
	 * インスタンス稼働先のプロセス(game-runner)の識別子
	 */
	@Annotations.map()
	public processName: string;
	/**
	 * 実行する js ファイルのパス
	 */
	@Annotations.map()
	public entryPoint: string;

	public toEntity(): dt.Instance {
		let modules: dt.InstanceModule[] = [];
		try {
			const parsedModules = JSON.parse(this.modules);
			modules = dt.InstanceModule.fromObjects(parsedModules);
		} catch (e) {
			// パースに失敗したらmodule無しとみなす
		}
		return new dt.Instance({
			id: this.id,
			gameCode: this.gameCode,
			modules,
			status: this.status,
			region: this.region,
			exitCode: this.exitCode,
			cost: this.cost,
			processName: this.processName,
			entryPoint: this.entryPoint,
		});
	}
}

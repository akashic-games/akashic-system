import * as Cast from "@akashic/cast-util";
import * as dt from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

/**
 * プロセス識別へのパッチ
 */
export interface ProcessIdentityPatch {
	/**
	 * マシンのFQDN逆順
	 */
	fqdn?: dt.Fqdn;
	/**
	 * 種別
	 */
	type?: string;
	/**
	 * 名称
	 */
	name?: string;
}

/**
 * プロセス識別のための情報 (プロセス生死とは無関係)
 */
export class ProcessIdentity {
	/**
	 * パッチ情報からの情報の取得と型チェック
	 */
	public static fromPatch(entity: ProcessIdentityPatch): ProcessIdentity {
		const result = new ProcessIdentity();
		result.reverseFqdn = Cast.string(entity.fqdn.toReverseFQDN(), 255);
		result.type = Cast.string(entity.type, 32);
		result.name = Cast.string(entity.name, 32);
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

	public toEntity(): dt.ProcessIdentity {
		return new dt.ProcessIdentity({
			fqdn: dt.Fqdn.fromReverseFqdn(this.reverseFqdn),
			type: this.type,
			name: this.name,
		});
	}
}

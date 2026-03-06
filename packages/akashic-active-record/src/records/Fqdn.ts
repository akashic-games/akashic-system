import * as CastUtil from "@akashic/cast-util";
import * as ServerEngineDataTypes from "@akashic/server-engine-data-types";
import { Annotations } from "@akashic/tapper";

/**
 * reverseFqdn情報へのパッチ
 */
export interface ReverseFqdnPatch {
	reverseFqdn?: string;
}

export class Fqdn {
	public static fromPatch(entity: ReverseFqdnPatch): Fqdn {
		const result = new Fqdn();
		if (entity.reverseFqdn) {
			result.reverseFqdn = CastUtil.string(entity.reverseFqdn, 255);
		}
		return result;
	}

	/**
	 * マシンのFQDN逆順
	 *
	 */
	@Annotations.map()
	public reverseFqdn: string;

	public toEntity(): ServerEngineDataTypes.Fqdn {
		return ServerEngineDataTypes.Fqdn.fromReverseFqdn(this.reverseFqdn);
	}
}

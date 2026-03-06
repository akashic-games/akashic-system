import Cast = require("@akashic/cast-util");

/**
 * FQDNオブジェクト
 */
class Fqdn {
	/**
	 * FQDNの文字列
	 */
	get value(): string {
		return this._fqdn;
	}

	/**
	 * 逆順FQDNからFQDNを取得
	 */
	public static fromReverseFqdn(reverseFqdn: string): Fqdn {
		return new Fqdn(reverseFqdn.split(".").reverse().join("."));
	}

	public static fromObject(obj: any): Fqdn {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		if (typeof obj === "string") {
			return new Fqdn(Cast.fqdnOrHostname(obj, false, "obj is not valid fqdn"));
		}
		if (typeof obj.value === "string") {
			return new Fqdn(Cast.fqdnOrHostname(obj.value, false, "obj is not valid fqdn"));
		}
		throw new TypeError("obj is not fqdn value");
	}
	private _fqdn: string;

	constructor(fqdn: string) {
		this._fqdn = fqdn;
	}

	public reverse(): string[] {
		return this._fqdn.split(".").reverse();
	}
	/**
	 * FQDNの逆順を取得
	 */
	public toReverseFQDN(): string {
		return this.reverse().join(".");
	}

	public toJSON(): string {
		return this._fqdn;
	}
}
export = Fqdn;

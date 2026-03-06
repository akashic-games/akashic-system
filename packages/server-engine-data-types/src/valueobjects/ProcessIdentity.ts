import Cast = require("@akashic/cast-util");
import FQDN = require("./Fqdn");
import ProcessIdentityLike = require("./ProcessIdentityLike");

/**
 * 各プロセスをクラスタ全体構成で識別するためのIdentity。プロセスが死んで復活しても変わらない
 */
class ProcessIdentity implements ProcessIdentityLike {
	/**
	 * プロセス種別(ConstantsのTYPE_*定数を使用する)
	 */
	get type(): string {
		return this._type;
	}

	/**
	 * プロセス名。同一マシンの同一種別のプロセスを区別するために与えられる/報告される値
	 */
	get name(): string {
		return this._name;
	}

	/**
	 * プロセスが存在するマシンのFQDN
	 */
	get fqdn(): FQDN {
		return this._fqdn;
	}
	public static fromObject(obj: any): ProcessIdentity {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new ProcessIdentity({
			type: Cast.uriUnreserved(obj.type, 32, false, "property type is not valid"),
			name: Cast.uriUnreserved(obj.name, 32, false, "property name is not valid"),
			fqdn: FQDN.fromObject(obj.fqdn),
		});
	}
	private _name: string;
	private _type: string;
	private _fqdn: FQDN;
	constructor(identity: ProcessIdentityLike) {
		this._name = identity.name;
		this._type = identity.type;
		this._fqdn = new FQDN(identity.fqdn.value);
	}
	public getKeyString(): string {
		return [this._fqdn.toReverseFQDN(), this._type, this._name].join(".");
	}
	public toJSON(): ProcessIdentityLike {
		return {
			type: this._type,
			name: this._name,
			fqdn: this._fqdn,
		};
	}
}
export = ProcessIdentity;

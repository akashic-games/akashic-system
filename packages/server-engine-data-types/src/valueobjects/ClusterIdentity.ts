import Cast = require("@akashic/cast-util");
import ClusterIdentityLike = require("./ClusterIdentityLike");
import FQDN = require("./Fqdn");
import ProcessIdentityLike = require("./ProcessIdentityLike");

/**
 * 各プロセスをクラスタ全体で、死んで復活しても識別するためのIdentity
 */
class ClusterIdentity implements ClusterIdentityLike {
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
	/**
	 * プロセスのzookeeper上のznodeのczxid
	 */
	get czxid(): string {
		return this._czxid;
	}

	public static fromObject(obj: any): ClusterIdentity {
		if (!obj) {
			throw new TypeError("obj is not valid");
		}
		return new ClusterIdentity({
			type: Cast.string(obj.type, 32, false, "property type is not valid"),
			name: Cast.string(obj.name, 32, false, "property name is not valid"),
			fqdn: FQDN.fromObject(obj.fqdn),
			czxid: Cast.bigint(obj.czxid, false, "property czxid is not valid"),
		});
	}

	/**
	 * プロセスとczxidからClusterIdentityを作成
	 */
	public static fromProcessAndCzxid(process: ProcessIdentityLike, czxid: string): ClusterIdentity {
		return new ClusterIdentity({
			fqdn: process.fqdn,
			type: process.type,
			name: process.name,
			czxid,
		});
	}
	private _type: string;
	private _name: string;
	private _fqdn: FQDN;
	private _czxid: string;
	/**
	 * Identityのコンストラクタ
	 * @type {ClusterIdentityLike} identity
	 */
	constructor(identity: ClusterIdentityLike) {
		this._type = identity.type;
		this._name = identity.name;
		this._fqdn = new FQDN(identity.fqdn.value);
		this._czxid = identity.czxid;
	}
	public getKeyString(): string {
		return [this._fqdn.toReverseFQDN(), this._type, this._name, this._czxid].join(".");
	}
	public isSame(other: ClusterIdentityLike): boolean {
		return this._fqdn.value === other.fqdn.value && this._type === other.type && this._name === other.name && this._czxid === other.czxid;
	}
	public toJSON(): ClusterIdentityLike {
		return {
			type: this._type,
			name: this._name,
			fqdn: new FQDN(this._fqdn.value),
			czxid: this._czxid,
		};
	}
}
export = ClusterIdentity;

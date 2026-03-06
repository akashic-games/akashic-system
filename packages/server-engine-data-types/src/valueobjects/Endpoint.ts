import Cast = require("@akashic/cast-util");
import EndpointLike = require("./EndpointLike");
import Fqdn = require("./Fqdn");

class Endpoint implements EndpointLike {
	/**
	 * endpointがいるfqdn
	 */
	get fqdn(): Fqdn {
		return this._fqdn;
	}
	/**
	 * endpointがいるport
	 */
	get port(): number {
		return this._port;
	}
	public static fromBuffer(buffer: Buffer): Endpoint {
		const data = JSON.parse(buffer.toString("utf-8"));
		return new Endpoint({
			fqdn: new Fqdn(Cast.string(data.fqdn, 255, false, "property fqdn is not valid")),
			port: Cast.int(data.port, false, "property pport is not valid"),
		});
	}
	private _fqdn: Fqdn;
	private _port: number;
	constructor(args: EndpointLike) {
		this._fqdn = args.fqdn;
		this._port = args.port;
	}
	public toJSON(): EndpointLike {
		return {
			fqdn: this._fqdn,
			port: this._port,
		};
	}
	public toBuffer(): Buffer {
		return Buffer.from(JSON.stringify(this), "utf-8");
	}
}
export = Endpoint;

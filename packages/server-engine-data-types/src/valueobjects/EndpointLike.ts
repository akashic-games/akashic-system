import Fqdn = require("./Fqdn");

interface EndpointLike {
	/**
	 * endpointがいるfqdn
	 */
	fqdn: Fqdn;
	/**
	 * endpointがいるポート番号
	 */
	port: number;
}
export = EndpointLike;

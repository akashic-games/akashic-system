import sha3 = require("js-sha3");
import TokenHashLength = require("./TokenHashLength");

class TokenGenerator {
	private secret: string;
	private hashFunc: (message: string) => string;
	constructor(secret: string, hashlength: TokenHashLength) {
		if (typeof secret !== "string" || secret.length < 12) {
			throw new Error("invalid secret Token");
		}
		this.secret = secret;
		switch (hashlength) {
			case TokenHashLength.Length256:
				this.hashFunc = sha3.keccak_256;
				break;
			case TokenHashLength.Length384:
				this.hashFunc = sha3.keccak_384;
				break;
			default:
				this.hashFunc = sha3.keccak_512;
				break;
		}
	}
	public generate(...args: any[]): string {
		const key = args.join("-") + "-" + this.secret;
		return this.hashFunc(key);
	}
}
export = TokenGenerator;

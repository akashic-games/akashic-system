import TokenGenerator = require("../../src/services/TokenGenerator");
import TokenHashLength = require("../../src/services/TokenHashLength");

describe("TokenGenerator", () => {
	it("test-len256", () => {
		expect("b8cb921d5314c29e82bb9649c80785e1cb001b7b10136e1be680e433ec0c1df8").toEqual(
			new TokenGenerator("upLf2edIiHmhN9dY512X", TokenHashLength.Length256).generate("warthog"),
		);
	});
	it("test-len384", () => {
		expect("a42c760ecc5392a10f3de00d5bff54f06e477f1f79223e1e121e200c99f3de20f31e9ada3113b965d842e6a7c26a9bdd").toEqual(
			new TokenGenerator("upLf2edIiHmhN9dY512X", TokenHashLength.Length384).generate("warthog"),
		);
	});
	it("test-len512", () => {
		expect(
			"df38d88eb614c461806a65cfea01d47b77a692f04fe8f715b0a1b90f678e0e0bdfd69f7eff802e0acf5d0dd9d9c08a5385c78982b1ff97c985e9dad295081218",
		).toEqual(new TokenGenerator("upLf2edIiHmhN9dY512X", TokenHashLength.Length512).generate("warthog"));
	});
});

import * as Message from "./SessionControlMessage";

// 各 Message クラスの単体テスト ここから
describe("EstablishRequestMessage", () => {
	describe("toBytes method", () => {
		const message = new Message.EstablishRequestMessage();
		it("should return Buffer", () => {
			expect(message.toBytes()).toEqual(expect.any(Buffer));
		});
	});
});
describe("EstablishResponseMessage", () => {
	describe("toBytes method", () => {
		const message = new Message.EstablishResponseMessage("the_uid");
		it("should return Buffer", () => {
			expect(message.toBytes()).toEqual(expect.any(Buffer));
		});
	});
});
describe("ValidateRequestMessage", () => {
	describe("toBytes method", () => {
		const message = new Message.ValidateRequestMessage("play_id", "i_am_token");
		it("should return Buffer", () => {
			expect(message.toBytes()).toEqual(expect.any(Buffer));
		});
	});
});
describe("ValidateResponseMessage", () => {
	describe("toBytes method", () => {
		const message = new Message.ValidateResponseMessage(true);
		it("should return Buffer", () => {
			expect(message.toBytes()).toEqual(expect.any(Buffer));
		});
	});
});
// 各 Message クラスの単体テスト ここまで

describe("toRequestMessage()", () => {
	describe("from EstablishRequestMessage packet", () => {
		const message = new Message.EstablishRequestMessage();
		const packet = message.toBytes();
		it("should restore origin message", () => {
			expect(Message.toRequestMessage(packet)).toEqual(message);
		});
	});
	describe("from ValidateRequestMessage packet", () => {
		const message = new Message.ValidateRequestMessage("play_id", "the_token");
		const packet = message.toBytes();
		it("should restore origin message", () => {
			expect(Message.toRequestMessage(packet)).toEqual(message);
		});
	});
	describe("from EstablishResponseMessage packet", () => {
		// Packet から Message に戻す場合は、Request or Response はチェックされない
		test.todo("not suppose");
	});
	describe("from ValidateRequestMessage packet", () => {
		// Packet から Message に戻す場合は、Request or Response はチェックされない
		test.todo("not suppose");
	});
	describe("from broken packet", () => {
		describe("case invalid JSON", () => {
			const invalidJsonString = "{{";
			const invalidJsonPacket = Buffer.from(invalidJsonString);
			// 「何も返さない」は、テストしなくていいかなって感じある。
			// JavaScript 界隈だと、「JSON のパース失敗 -> Syntax Error」という感覚が一般的なので、[要出典]
			// 「エラーを握りつぶしてる」っていう実装は、 Assert すべき。
			it("should return, NOT throws", () => {
				expect(() => {
					Message.toRequestMessage(invalidJsonPacket);
				}).not.toThrowError();
			});
		});
		describe("case invalid Packet", () => {
			const notMessageJson = JSON.stringify({});
			const notMessagePacket = Buffer.from(notMessageJson);
			it("should return null", () => {
				expect(Message.toRequestMessage(notMessagePacket)).toBeNull();
			});
		});
	});
});

describe("toResponseMessage()", () => {
	describe("from EstablishResponseMessage packet", () => {
		const message = new Message.EstablishResponseMessage("the_uid");
		const packet = message.toBytes();
		it("should restore origin message", () => {
			expect(Message.toResponseMessage(packet)).toEqual(message);
		});
	});
	describe("from ValidateResponseMessage packet", () => {
		const message = new Message.ValidateResponseMessage(true);
		const packet = message.toBytes();
		it("should restore origin message", () => {
			expect(Message.toResponseMessage(packet)).toEqual(message);
		});
	});
	describe("from EstablishRequestMessage packet", () => {
		// Packet から Message に戻す場合は、Request or Response はチェックされない
		test.todo("not suppose");
	});
	describe("from ValidateRequestMessage packet", () => {
		// Packet から Message に戻す場合は、Request or Response はチェックされない
		test.todo("not suppose");
	});
	describe("from broken packet", () => {
		describe("case invalid JSON", () => {
			const invalidJsonString = "{{";
			const invalidJsonPacket = Buffer.from(invalidJsonString);
			// 「何も返さない」は、テストしなくていいかなって感じある。
			// JavaScript 界隈だと、「JSON のパース失敗 -> Syntax Error」という感覚が一般的なので、[要出典]
			// 「エラーを握りつぶしてる」っていう実装は、 Assert すべき。
			it("should return, NOT throws", () => {
				expect(() => {
					Message.toResponseMessage(invalidJsonPacket);
				}).not.toThrowError();
			});
		});
		describe("case invalid Packet", () => {
			const notMessageJson = JSON.stringify({});
			const notMessagePacket = Buffer.from(notMessageJson);
			it("should return null", () => {
				expect(Message.toResponseMessage(notMessagePacket)).toBeNull();
			});
		});
	});
});

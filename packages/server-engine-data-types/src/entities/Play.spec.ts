import Play = require("./Play");
import PlayLike = require("./PlayLike");

const gameCode: string = "ncg456";

describe("Play", () => {
	it("test-constructor", () => {
		const data: PlayLike = {
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		const play = new Play(data);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-id", () => {
		const data: PlayLike = {
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		const play = new Play(data, "123");
		expect("123").toEqual(play.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-id2", () => {
		const data: PlayLike = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		const play = new Play(data);
		expect(data.id).toEqual(play.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-id3", () => {
		const data: PlayLike = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		const play = new Play(data, "456");
		expect("456").toEqual(play.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-finished", () => {
		const data: PlayLike = {
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		const date = new Date("02/01/70 00:00:00");
		const play = new Play(data, "123", date);
		expect("123").toEqual(play.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(date).toEqual(play.finished);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-finished2", () => {
		const data: PlayLike = {
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		const play = new Play(data);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.finished).toEqual(play.finished);
		expect(data.status).toEqual(play.status);
	});
	it("test-constructor-with-finished3", () => {
		const data: PlayLike = {
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		const date = new Date("03/01/70 00:00:00");
		const play = new Play(data, "123", date);
		expect("123").toEqual(play.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(date).toEqual(play.finished);
		expect(data.status).toEqual(play.status);
	});
	it("test-toJSON", () => {
		let data: PlayLike = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		let play = Play.fromObject(new Play(data).toJSON());
		expect(play.id).toEqual(data.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.finished).toEqual(play.finished);
		expect(data.status).toEqual(play.status);

		data = {
			gameCode,
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		play = Play.fromObject(new Play(data).toJSON());
		expect(play.id).toBeUndefined();
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toBeUndefined();
		expect(data.started).toEqual(play.started);
		expect(data.finished).toBeUndefined();
		expect(data.status).toEqual(play.status);
	});
	it("test-fromObject", () => {
		let data: PlayLike = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		let play = Play.fromObject(data);
		expect(play.id).toEqual(data.id);
		expect(data.gameCode).toEqual(play.gameCode);
		expect(data.parentId).toEqual(play.parentId);
		expect(data.started).toEqual(play.started);
		expect(data.finished).toEqual(play.finished);
		expect(data.status).toEqual(play.status);

		data = {
			gameCode,
			started: new Date("01/01/70 00:00:00"),
			status: "running",
		};
		play = Play.fromObject(data);
		expect(play.id).toBeUndefined();
		expect(play.gameCode).toEqual(data.gameCode);
		expect(play.parentId).toBeUndefined();
		expect(play.started).toEqual(data.started);
		expect(play.finished).toBeUndefined();
		expect(play.status).toEqual(data.status);

		const data2 = {
			gameCode,
			parentId: "111",
			started: "2001/01/20 00:00:00",
			finished: "2002/01/30 00:00:00",
			status: "running",
		};
		play = Play.fromObject(data2);
		expect(play.id).toBeUndefined();
		expect(play.gameCode).toEqual(data2.gameCode);
		expect(play.parentId).toEqual(data2.parentId);
		expect(play.started.getTime()).toEqual(new Date(data2.started).getTime());
		expect(play.finished.getTime()).toEqual(new Date(data2.finished).getTime());
		expect(play.status).toEqual(data2.status);
	});
	it("test-fromObject-error", () => {
		let data: any;
		data = {
			id: "invalid id",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		expect(() => Play.fromObject(data)).toThrow();
		data = {
			id: "123",
			gameCode,
			parentId: [111],
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		expect(() => Play.fromObject(data)).toThrow();
		data = {
			id: "123",
			gameCode,
			parentId: "111",
			started: null,
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		expect(() => Play.fromObject(data)).toThrow();
		data = {
			id: "123",
			gameCode,
			parentId: "111",
			started: "dummy date string",
			finished: new Date("02/01/70 00:00:00"),
			status: "running",
		};
		expect(() => Play.fromObject(data)).toThrow();
		data = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: "undefined",
			status: "running",
		};
		expect(() => Play.fromObject(data)).toThrow();
		data = {
			id: "123",
			gameCode,
			parentId: "111",
			started: new Date("01/01/70 00:00:00"),
			finished: new Date("02/01/70 00:00:00"),
			status: undefined,
		};
		expect(() => Play.fromObject(data)).toThrow();
		expect(() => Play.fromObject(null)).toThrow();
	});
});

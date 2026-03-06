import Constants = require("../constants");
import { EventHandler } from "./EventHandler";
import { EventHandlerLike } from "./EventHandlerLike";

describe("EventHandler", () => {
	it("test-constructor", () => {
		const data: EventHandlerLike = {
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		const eventHandler = new EventHandler(data);
		expect(eventHandler.id).toBeUndefined();
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
	});
	it("test-constructor-with-id", () => {
		let data: EventHandlerLike = {
			id: "12345",
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		let eventHandler = new EventHandler(data);
		expect(eventHandler.id).toEqual(data.id);
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
		data = {
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		eventHandler = new EventHandler(data, "12345");
		expect(eventHandler.id).toEqual("12345");
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
	});
	it("test-toJson", () => {
		let data: EventHandlerLike = {
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		let eventHandler = EventHandler.fromObject(new EventHandler(data).toJSON());
		expect(eventHandler.id).toBeUndefined();
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
		data = {
			id: "12345",
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		eventHandler = EventHandler.fromObject(new EventHandler(data).toJSON());
		expect(eventHandler.id).toEqual(data.id);
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
	});
	it("test-fromObject", () => {
		let eventHandler: EventHandler;
		let data: any = {
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		eventHandler = EventHandler.fromObject(data);
		expect(eventHandler.id).toBeUndefined();
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
		data = {
			id: "12345",
			type: Constants.EVENT_HANDLER_TYPE_INSTANCE_STATUS,
			endpoint: "http://example.nico",
			protocol: "http",
		};
		eventHandler = EventHandler.fromObject(data);
		expect(eventHandler.id).toEqual(data.id);
		expect(eventHandler.type).toEqual(data.type);
		expect(eventHandler.endpoint).toEqual(data.endpoint);
		expect(eventHandler.protocol).toEqual(data.protocol);
		expect(() => EventHandler.fromObject(null)).toThrow();
	});
});

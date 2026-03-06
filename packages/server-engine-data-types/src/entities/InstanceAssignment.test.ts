import Fqdn = require("../valueobjects/Fqdn");
import InstanceAssignment = require("./InstanceAssignment");
import InstanceAssignmentLike = require("./InstanceAssignmentLike");

describe("InstanceAssignment", () => {
	it("test-constructor", () => {
		const data: InstanceAssignmentLike = {
			targetIdentity: {
				fqdn: new Fqdn("foobar.example.com"),
				type: "gameRunner",
				name: "10",
				czxid: "37564",
			},
			targetPort: 8080,
			instanceId: "789456",
			gameCode: "ncg456",
			entryPoint: "akashic/v1.0/entry.js",
			requirement: 10,
			modules: [
				{
					code: "hoge",
					values: {
						playId: "1234",
						executionMode: "active",
					},
				},
			],
		};
		const instanceAssignment = new InstanceAssignment(data);
		expect(data.targetIdentity.fqdn.value).toEqual(instanceAssignment.targetIdentity.fqdn.value);
		expect(data.targetIdentity.name).toEqual(instanceAssignment.targetIdentity.name);
		expect(data.targetIdentity.type).toEqual(instanceAssignment.targetIdentity.type);
		expect(data.targetIdentity.czxid).toEqual(instanceAssignment.targetIdentity.czxid);
		expect(data.targetPort).toEqual(instanceAssignment.targetPort);
		expect(data.gameCode).toEqual(instanceAssignment.gameCode);
		expect(data.instanceId).toEqual(instanceAssignment.instanceId);
		expect(data.entryPoint).toEqual(instanceAssignment.entryPoint);
		expect(data.requirement).toEqual(instanceAssignment.requirement);
		expect(JSON.stringify(data.modules)).toEqual(JSON.stringify(instanceAssignment.modules));
	});
	it("test-constructor-with-id", () => {
		const data: InstanceAssignmentLike = {
			targetIdentity: {
				fqdn: new Fqdn("foobar.example.com"),
				type: "gameRunner",
				name: "10",
				czxid: "37564",
			},
			targetPort: 8080,
			instanceId: "789456",
			gameCode: "ncg456",
			entryPoint: "akashic/v1.0/entry.js",
			requirement: 10,
			modules: [
				{
					code: "hoge",
					values: {
						playId: "1234",
						executionMode: "active",
					},
				},
			],
		};
		const instanceAssignment = new InstanceAssignment(data, "123456789");
		expect(data.targetIdentity.fqdn.value).toEqual(instanceAssignment.targetIdentity.fqdn.value);
		expect(data.targetIdentity.name).toEqual(instanceAssignment.targetIdentity.name);
		expect(data.targetIdentity.type).toEqual(instanceAssignment.targetIdentity.type);
		expect(data.targetIdentity.czxid).toEqual(instanceAssignment.targetIdentity.czxid);
		expect(data.targetPort).toEqual(instanceAssignment.targetPort);
		expect(data.gameCode).toEqual(instanceAssignment.gameCode);
		expect(data.instanceId).toEqual(instanceAssignment.instanceId);
		expect(data.entryPoint).toEqual(instanceAssignment.entryPoint);
		expect(data.requirement).toEqual(instanceAssignment.requirement);
		expect(JSON.stringify(data.modules)).toEqual(JSON.stringify(instanceAssignment.modules));
		expect("123456789").toEqual(instanceAssignment.id);
	});
	it("test-constructor-with-id2", () => {
		const data: InstanceAssignmentLike = {
			id: "123456789",
			targetIdentity: {
				fqdn: new Fqdn("foobar.example.com"),
				type: "gameRunner",
				name: "10",
				czxid: "37564",
			},
			targetPort: 8080,
			instanceId: "789456",
			gameCode: "ncg456",
			entryPoint: "akashic/v1.0/entry.js",
			requirement: 10,
			modules: [
				{
					code: "hoge",
					values: {
						playId: "1234",
						executionMode: "active",
					},
				},
			],
		};
		const instanceAssignment = new InstanceAssignment(data);
		expect(data.targetIdentity.fqdn.value).toEqual(instanceAssignment.targetIdentity.fqdn.value);
		expect(data.targetIdentity.name).toEqual(instanceAssignment.targetIdentity.name);
		expect(data.targetIdentity.type).toEqual(instanceAssignment.targetIdentity.type);
		expect(data.targetIdentity.czxid).toEqual(instanceAssignment.targetIdentity.czxid);
		expect(data.targetPort).toEqual(instanceAssignment.targetPort);
		expect(data.gameCode).toEqual(instanceAssignment.gameCode);
		expect(data.instanceId).toEqual(instanceAssignment.instanceId);
		expect(data.entryPoint).toEqual(instanceAssignment.entryPoint);
		expect(data.requirement).toEqual(instanceAssignment.requirement);
		expect(JSON.stringify(data.modules)).toEqual(JSON.stringify(instanceAssignment.modules));
		expect("123456789").toEqual(instanceAssignment.id);
	});
	it("test-constructor-with-id2", () => {
		const data: InstanceAssignmentLike = {
			id: "77744477",
			targetIdentity: {
				fqdn: new Fqdn("foobar.example.com"),
				type: "gameRunner",
				name: "10",
				czxid: "37564",
			},
			targetPort: 8080,
			instanceId: "789456",
			gameCode: "ncg456",
			entryPoint: "akashic/v1.0/entry.js",
			requirement: 10,
			modules: [
				{
					code: "hoge",
					values: {
						playId: "1234",
						executionMode: "active",
					},
				},
			],
		};
		const instanceAssignment = new InstanceAssignment(data, "123456789");
		expect(data.targetIdentity.fqdn.value).toEqual(instanceAssignment.targetIdentity.fqdn.value);
		expect(data.targetIdentity.name).toEqual(instanceAssignment.targetIdentity.name);
		expect(data.targetIdentity.type).toEqual(instanceAssignment.targetIdentity.type);
		expect(data.targetIdentity.czxid).toEqual(instanceAssignment.targetIdentity.czxid);
		expect(data.targetPort).toEqual(instanceAssignment.targetPort);
		expect(data.gameCode).toEqual(instanceAssignment.gameCode);
		expect(data.instanceId).toEqual(instanceAssignment.instanceId);
		expect(data.entryPoint).toEqual(instanceAssignment.entryPoint);
		expect(data.requirement).toEqual(instanceAssignment.requirement);
		expect(JSON.stringify(data.modules)).toEqual(JSON.stringify(instanceAssignment.modules));
		expect("123456789").toEqual(instanceAssignment.id);
	});
});

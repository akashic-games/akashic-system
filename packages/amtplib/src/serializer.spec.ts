import * as fr from "./Frame";
import * as sr from "./Serializer";

describe("Serializer", () => {
	describe("serialize", function () {
		describe("valid", function () {
			it("AcceptControlFrame", function () {
				let f: fr.AcceptControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Accept,
					id: 100,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x81, 0, 0, 0, 100]));
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Accept,
					id: 256,
					data: Buffer.from([1, 2, 3]),
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x81, 0, 0, 1, 0, 1, 2, 3]));
			});
			it("DenyControlFrame", function () {
				const f: fr.DenyControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Deny,
					id: 2,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x82, 0, 0, 0, 2]));
			});
			it("OpenControlFrame", function () {
				const f: fr.OpenControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Open,
					id: 100,
					protocolVersion: 1,
					protocolIdentifier: 33,
					random: 44,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x83, 0, 0, 0, 100, 0, 0, 0, 33, 1, 0, 0, 0, 44]));
			});
			it("CloseControlFrame", function () {
				const f: fr.CloseControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Close,
					id: 100,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x86, 0, 0, 0, 100]));
			});
			it("ChannelControlFrame", function () {
				let f: fr.ChannelControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Channel,
					id: 200,
					channelId: 20,
					primary: false,
					label: "abc",
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x84, 0, 0, 0, 200, 0, 0, 0, 20, 0x61, 0x62, 0x63]));
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Channel,
					id: 200,
					channelId: 20,
					primary: true,
					label: "",
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x84, 0, 0, 0, 200, 0x80, 0, 0, 20]));
			});
			it("CloseChannelControlFrame", function () {
				const f: fr.CloseChannelControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.CloseChannel,
					id: 200,
					channelId: 20,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x87, 0, 0, 0, 200, 0, 0, 0, 20]));
			});
			it("PipeControlFrame", function () {
				let f: fr.PipeControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Pipe,
					id: 200,
					channelId: 20,
					pipeId: 3,
					primary: false,
					request: false,
					label: "def",
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x85, 0, 0, 0, 200, 0, 0, 0, 20, 0, 0, 0, 3, 0x64, 0x65, 0x66]));
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Pipe,
					id: 200,
					channelId: 20,
					pipeId: 3,
					primary: true,
					request: true,
					label: "",
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x85, 0, 0, 0, 200, 0x80, 0, 0, 20, 0x80, 0, 0, 3]));
			});
			it("ClosePipeControlFrame", function () {
				let f: fr.ClosePipeControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.ClosePipe,
					id: 200,
					request: true,
					channelId: 20,
					pipeId: 30,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x88, 0, 0, 0, 200, 0, 0, 0, 20, 0x80, 0, 0, 30]));
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.ClosePipe,
					id: 200,
					request: false,
					channelId: 20,
					pipeId: 30,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x88, 0, 0, 0, 200, 0, 0, 0, 20, 0, 0, 0, 30]));
			});
			it("DataFrame", function () {
				const payload = Buffer.from([1, 2, 3]);
				let f: fr.DataFrame = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: true,
					primaryPipe: true,
					request: false,
					payload,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0, 1, 2, 3]));
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: true,
					request: false,
					payload,
					channelId: 100,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x40, 0, 0, 0, 100, 1, 2, 3]));
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: false,
					request: false,
					payload,
					channelId: 100,
					pipeId: 256,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x60, 0, 0, 0, 100, 0, 0, 1, 0, 1, 2, 3]));
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: false,
					request: true,
					payload,
					channelId: 100,
					pipeId: 256,
					requestId: 1,
				};
				expect(sr.serialize(f)).toEqual(Buffer.from([0x70, 0, 0, 0, 100, 0, 0, 1, 0, 0, 0, 0, 1, 1, 2, 3]));
			});
		});
		describe("Errors", function () {
			it("InvalidFrameIdentifier", function () {
				// 言語仕様として、enum は正の整数が assign される。
				// もし、FrameIdentifier に、負の整数が使用されるような仕様に変更された場合、
				// ここの値をより確実に Invalid なものに変更する必要がある。
				const f: fr.Frame = {
					identifier: -1 as fr.FrameIdentifier,
				};
				expect(function () {
					sr.serialize(f);
				}).toThrowError("Unknown frame identifier");
			});
		});
	});
	describe("deserialize", function () {
		describe("valid", function () {
			it("AcceptControlFrame", function () {
				const f: fr.AcceptControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Accept,
					id: 100,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("AcceptControlFrame_WithData", function () {
				const data = Buffer.from([1, 2, 3, 4, 5, 6]);
				const f: fr.AcceptControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Accept,
					id: 100,
					data,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("DenyControlFrame", function () {
				const f: fr.DenyControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Deny,
					id: 2,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("OpenControlFrame", function () {
				const f: fr.OpenControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Open,
					id: 100,
					protocolVersion: 1,
					protocolIdentifier: 33,
					random: 44,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("CloseControlFrame", function () {
				const f: fr.CloseControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Close,
					id: 100,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("ChannelControlFrame", function () {
				let f: fr.ChannelControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Channel,
					id: 200,
					channelId: 20,
					primary: false,
					label: "foo",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Channel,
					id: 200,
					channelId: 20,
					primary: true,
					label: "bar",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("ChannelControlFrame_EmptyLabel", function () {
				const f: fr.ChannelControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Channel,
					id: 200,
					channelId: 20,
					primary: false,
					label: "",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("CloseChannelControlFrame", function () {
				const f: fr.CloseChannelControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.CloseChannel,
					id: 200,
					channelId: 20,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("PipeControlFrame", function () {
				let f: fr.PipeControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Pipe,
					id: 200,
					channelId: 20,
					pipeId: 3,
					primary: false,
					request: false,
					label: "foo",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Pipe,
					id: 200,
					channelId: 20,
					pipeId: 3,
					primary: true,
					request: true,
					label: "bar",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("PipeControlFrame_EmptyLabel", function () {
				const f: fr.PipeControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.Pipe,
					id: 200,
					channelId: 20,
					pipeId: 3,
					primary: false,
					request: false,
					label: "",
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("ClosePipeControlFrame", function () {
				let f: fr.ClosePipeControlFrame = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.ClosePipe,
					id: 200,
					request: true,
					channelId: 20,
					pipeId: 30,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Control,
					type: fr.ControlFrameType.ClosePipe,
					id: 200,
					request: false,
					channelId: 20,
					pipeId: 30,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
			it("DataFrame", function () {
				const payload = Buffer.from([1, 2, 3]);
				let f: fr.DataFrame = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: true,
					primaryPipe: true,
					request: false,
					payload,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: true,
					request: false,
					payload,
					channelId: 100,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: false,
					request: false,
					payload,
					channelId: 100,
					pipeId: 256,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
				f = {
					identifier: fr.FrameIdentifier.Data,
					primaryChannel: false,
					primaryPipe: false,
					request: true,
					payload,
					channelId: 100,
					pipeId: 256,
					requestId: 1,
				};
				expect(sr.deserialize(sr.serialize(f))).toEqual(f);
			});
		});
	});
});

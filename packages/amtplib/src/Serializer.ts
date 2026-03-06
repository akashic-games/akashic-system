import assert from "assert";
import * as fr from "./Frame";

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---------------------------------------------------------------+
// |                          Accept Data                          |
// +---------------------------------------------------------------+
function serializeAcceptControlFrame(frame: fr.AcceptControlFrame): Buffer {
	const buf = Buffer.alloc(5);
	buf[0] = fr.ControlFrameType.Accept | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	if (frame.data && frame.data.length) {
		return Buffer.concat([buf, frame.data], buf.length + frame.data.length);
	} else {
		return buf;
	}
}

function deserializeAcceptControlFrame(buf: Buffer): fr.AcceptControlFrame {
	const f: fr.AcceptControlFrame = {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.Accept,
		id: buf.readUInt32BE(1),
	};
	if (buf.length > 5) {
		f.data = buf.slice(5);
	}
	return f;
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---------------------------------------------------------------+
// |                    Protocol Identifier (32)                   |
// +---------------+-----------------------------------------------+
// |  Version (8)  |
// +---------------+-----------------------------------------------+
// |                        Random Bytes (32)                      |
// +---------------------------------------------------------------+
function serializeOpenControlFrame(frame: fr.OpenControlFrame): Buffer {
	assert(frame.protocolIdentifier <= 0xffffffff, "protocol identifier must be less than or equal to " + 0xffffffff);
	assert(frame.protocolVersion <= 0xff, "protocol version must be less than or equal to " + 0xff);
	assert(frame.random <= 0xffffffff, "random bytes must be less than or equal to " + 0xffffffff);
	const buf = Buffer.alloc(14);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	buf.writeUInt32BE(frame.protocolIdentifier, 5);
	buf[9] = frame.protocolVersion;
	buf.writeUInt32BE(frame.random, 10);
	return buf;
}

function deserializeOpenControlFrame(buf: Buffer): fr.OpenControlFrame {
	return {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.Open,
		id: buf.readUInt32BE(1),
		protocolIdentifier: buf.readUInt32BE(5),
		protocolVersion: buf[9],
		random: buf.readUInt32BE(10),
	};
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---------------------------------------------------------------+
function serializeCloseControlFrame(frame: fr.CloseControlFrame): Buffer {
	const buf = Buffer.alloc(5);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	return buf;
}

function deserializeCloseControlFrame(buf: Buffer): fr.CloseControlFrame {
	return {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.Close,
		id: buf.readUInt32BE(1),
	};
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---+-----------------------------------------------------------+
// | P |                    Channel ID                             |
// |(1)|                        (31)                               |
// +---+-----------------------------------------------------------+
// |                           Channel Label                       |
// +---------------------------------------------------------------+

function serializeChannelControlFrame(frame: fr.ChannelControlFrame): Buffer {
	assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
	const buf = Buffer.alloc(9);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	buf.writeUInt32BE(frame.channelId, 5);
	if (frame.primary) {
		buf[5] |= 0x80;
	}
	if (frame.label) {
		const label = Buffer.from(frame.label);
		assert(label.length <= 64, "label must be less than or equal to 64");
		return Buffer.concat([buf, label], buf.length + label.length);
	} else {
		return buf;
	}
}

function deserializeChannelControlFrame(buf: Buffer): fr.ChannelControlFrame {
	const f: fr.ChannelControlFrame = {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.Channel,
		id: buf.readUInt32BE(1),
		primary: !!(buf[5] & 0x80),
		channelId: buf.readUInt32BE(5) & 0x7fffffff,
		label: "",
	};
	if (buf.length > 9) {
		f.label = buf.slice(9).toString("utf8");
	}
	return f;
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---+-----------------------------------------------------------+
// | P |                      Channel ID                           |
// |(1)|                        (31)                               |
// +---+-----------------------------------------------------------+
// | R |                       Pipe ID                             |
// |(1)|                         (31)                              |
// +---+-----------------------------------------------------------+
// |                       Pipe Label (32)                         |
// +---------------------------------------------------------------+

function serializePipeControlFrame(frame: fr.PipeControlFrame): Buffer {
	assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
	assert(frame.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
	const buf = Buffer.alloc(13);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	buf.writeUInt32BE(frame.channelId, 5);
	if (frame.primary) {
		buf[5] |= 0x80;
	}
	buf.writeUInt32BE(frame.pipeId, 9);
	if (frame.request) {
		buf[9] |= 0x80;
	}
	if (frame.label) {
		const label = Buffer.from(frame.label);
		assert(label.length <= 64, "label must be less than or equal to 64");
		return Buffer.concat([buf, label], buf.length + label.length);
	} else {
		return buf;
	}
}

function deserializePipeControlFrame(buf: Buffer): fr.PipeControlFrame {
	const f: fr.PipeControlFrame = {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.Pipe,
		id: buf.readUInt32BE(1),
		primary: !!(buf[5] & 0x80),
		channelId: buf.readUInt32BE(5) & 0x7fffffff,
		request: !!(buf[9] & 0x80),
		pipeId: buf.readUInt32BE(9) & 0x7fffffff,
		label: "",
	};
	if (buf.length > 13) {
		f.label = buf.slice(13).toString("utf8");
	}
	return f;
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---+-----------------------------------------------------------+
// | X |                    Channel ID                             |
// |(1)|                        (31)                               |
// +---+-----------------------------------------------------------+
function serializeCloseChannelControlFrame(frame: fr.CloseChannelControlFrame): Buffer {
	assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
	const buf = Buffer.alloc(9);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	buf.writeUInt32BE(frame.channelId, 5);
	return buf;
}

function deserializeCloseChannelControlFrame(buf: Buffer): fr.CloseChannelControlFrame {
	return {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.CloseChannel,
		id: buf.readUInt32BE(1),
		channelId: buf.readUInt32BE(5) & 0x7fffffff,
	};
}

// +---+-----------+
// | F |    Type   |
// |(1)|     (7)   |
// +---------------------------------------------------------------+
// |                           ID (32)                             |
// +---+-----------------------------------------------------------+
// | X |                    Channel ID                             |
// |(1)|                        (31)                               |
// +---+-----------------------------------------------------------+
// | R |                      PipeID                               |
// |(1)|                        (31)                               |
// +---+-----------------------------------------------------------+
function serializeClosePipeControlFrame(frame: fr.ClosePipeControlFrame): Buffer {
	assert(frame.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
	assert(frame.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
	const buf = Buffer.alloc(13);
	buf[0] = frame.type | 0x80;
	buf.writeUInt32BE(frame.id, 1);
	buf.writeUInt32BE(frame.channelId, 5);
	buf.writeUInt32BE(frame.pipeId, 9);
	if (frame.request) {
		buf[9] |= 0x80;
	}
	return buf;
}

function deserializeClosePipeControlFrame(buf: Buffer): fr.ClosePipeControlFrame {
	return {
		identifier: fr.FrameIdentifier.Control,
		type: fr.ControlFrameType.ClosePipe,
		id: buf.readUInt32BE(1),
		channelId: buf.readUInt32BE(5) & 0x7fffffff,
		request: !!(buf[9] & 0x80),
		pipeId: buf.readUInt32BE(9) & 0x7fffffff,
	};
}

function serializeControlFrame(frame: fr.ControlFrame): Buffer {
	assert(frame.id > 0, "control frame id must be greater than 0");
	switch (frame.type) {
		case fr.ControlFrameType.Open:
			return serializeOpenControlFrame(frame as fr.OpenControlFrame);
		case fr.ControlFrameType.Channel:
			return serializeChannelControlFrame(frame as fr.ChannelControlFrame);
		case fr.ControlFrameType.Pipe:
			return serializePipeControlFrame(frame as fr.PipeControlFrame);
		case fr.ControlFrameType.CloseChannel:
			return serializeCloseChannelControlFrame(frame as fr.CloseChannelControlFrame);
		case fr.ControlFrameType.ClosePipe:
			return serializeClosePipeControlFrame(frame as fr.ClosePipeControlFrame);
		case fr.ControlFrameType.Accept:
			return serializeAcceptControlFrame(frame as fr.AcceptControlFrame);
		case fr.ControlFrameType.Close:
			return serializeCloseControlFrame(frame as fr.CloseControlFrame);
		default:
			// TODO: others?
			const buf = Buffer.alloc(5);
			buf[0] = frame.type | 0x80;
			buf.writeUInt32BE(frame.id, 1);
			return buf;
	}
}

function deserializeControlFrame(buf: Buffer): fr.ControlFrame {
	const type: fr.ControlFrameType = buf[0] & 0x7f;
	switch (type) {
		case fr.ControlFrameType.Open:
			return deserializeOpenControlFrame(buf);
		case fr.ControlFrameType.Channel:
			return deserializeChannelControlFrame(buf);
		case fr.ControlFrameType.Pipe:
			return deserializePipeControlFrame(buf);
		case fr.ControlFrameType.CloseChannel:
			return deserializeCloseChannelControlFrame(buf);
		case fr.ControlFrameType.ClosePipe:
			return deserializeClosePipeControlFrame(buf);
		case fr.ControlFrameType.Accept:
			return deserializeAcceptControlFrame(buf);
		case fr.ControlFrameType.Close:
			return deserializeCloseControlFrame(buf);
		default:
			// TODO: others?
			return {
				identifier: fr.FrameIdentifier.Control,
				type,
				id: buf.readUInt32BE(1),
			};
	}
}

// +---+---+---+---+---+
// | F | C | P | R | X |
// |(1)|(1)|(1)|(1)|(4)|
// +---+---+---+---+---+-------------------------------------------+
// | X |                        Channel ID                         |
// |(1)|                           (31)                            |
// +---+-----------------------------------------------------------+
// | X |                         Pipe ID                           |
// |(1)|                           (31)                            |
// +---+-----------------------------------------------------------+
// |                         Request ID (32)                       |
// +---------------------------------------------------------------+
// |                           Payload Data                        |
// +---------------------------------------------------------------+
function serializeDataFrame(frame: fr.DataFrame): Buffer {
	const f = frame;
	const header = Buffer.alloc(1 + (f.primaryChannel ? 0 : 4) + (f.primaryPipe ? 0 : 4) + (f.request ? 4 : 0));
	header[0] = (f.primaryChannel ? 0 : 0x40) | (f.primaryPipe ? 0 : 0x20) | (f.request ? 0x10 : 0);
	let offset = 1;
	if (!f.primaryChannel) {
		assert(f.channelId <= 0x7fffffff, "channelId must be less than or equal to " + 0x7fffffff);
		header.writeUInt32BE(f.channelId, offset);
		offset += 4;
	}
	if (!f.primaryPipe) {
		assert(f.pipeId <= 0x7fffffff, "pipeId must be less than or equal to " + 0x7fffffff);
		header.writeUInt32BE(f.pipeId, offset);
		offset += 4;
	}
	if (f.request) {
		assert(f.requestId <= 0xffffffff, "requestId must be less than or equal to " + 0xffffffff);
		header.writeUInt32BE(f.requestId, offset);
	}
	return Buffer.concat([header, f.payload], header.length + f.payload.length);
}

function deserializeDataFrame(buf: Buffer): fr.DataFrame {
	const frame: fr.DataFrame = {
		identifier: fr.FrameIdentifier.Data,
		primaryChannel: (buf[0] & 0x40) !== 0x40,
		primaryPipe: (buf[0] & 0x20) !== 0x20,
		request: (buf[0] & 0x10) === 0x10,
		payload: null,
	};
	let offset = 1;
	if (!frame.primaryChannel) {
		frame.channelId = buf.readUInt32BE(offset);
		offset += 4;
	}
	if (!frame.primaryPipe) {
		frame.pipeId = buf.readUInt32BE(offset);
		offset += 4;
	}
	if (frame.request) {
		frame.requestId = buf.readUInt32BE(offset);
		offset += 4;
	}
	frame.payload = buf.slice(offset);
	return frame;
}

export function serialize(frame: fr.Frame): Buffer {
	if (frame.identifier === fr.FrameIdentifier.Control) {
		return serializeControlFrame(frame as fr.ControlFrame);
	} else if (frame.identifier === fr.FrameIdentifier.Data) {
		return serializeDataFrame(frame as fr.DataFrame);
	} else {
		throw new Error("Unknown frame identifier");
	}
}

export function deserialize(buf: Buffer): fr.Frame {
	if ((buf[0] & 0x80) === 0x80) {
		return deserializeControlFrame(buf);
	} else {
		return deserializeDataFrame(buf);
	}
}

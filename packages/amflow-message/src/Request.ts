import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import assert from "assert";
import * as msgpack from "msgpack-lite";

import { Message, MessagePacket, MessageStatic } from "./Message";
import { Opcode } from "./Opcode";
// Open

export interface OpenRequestPacket extends MessagePacket {
	1: string;
}

export type ExcludeEventFlags = {
	// ignorableイベントを除外したtickかどうか
	ignorable?: boolean;
};

export class OpenRequest implements Message {
	public static fromPacket(packet: OpenRequestPacket): OpenRequest {
		assert(packet[0] === Opcode.Open);
		return new OpenRequest(packet[1]);
	}
	public code: Opcode;
	public playId: string;
	constructor(playId: string) {
		this.code = Opcode.Open;
		this.playId = playId;
	}
	public toPacket(): OpenRequestPacket {
		return [this.code, this.playId];
	}
}

// Authenticate

export interface AuthenticateRequestPacket extends MessagePacket {
	1: string;
}

export class AuthenticateRequest implements Message {
	public static fromPacket(packet: AuthenticateRequestPacket): AuthenticateRequest {
		assert(packet[0] === Opcode.Authenticate);
		return new AuthenticateRequest(packet[1]);
	}
	public code: Opcode;
	public token: string;
	constructor(token: string) {
		this.code = Opcode.Authenticate;
		this.token = token;
	}
	public toPacket(): AuthenticateRequestPacket {
		return [this.code, this.token];
	}
}

// Close

export interface CloseRequestPacket extends MessagePacket {}

export class CloseRequest implements Message {
	public static fromPacket(packet: CloseRequestPacket): CloseRequest {
		assert(packet[0] === Opcode.Close);
		return new CloseRequest();
	}
	public code: Opcode;
	constructor() {
		this.code = Opcode.Close;
	}
	public toPacket(): CloseRequestPacket {
		return [this.code];
	}
}

// GetTickList

export interface GetTickListRequestPacket extends MessagePacket {
	1: number;
	2: number;
	3: ExcludeEventFlags;
}

export class GetTickListRequest implements Message {
	public static fromPacket(packet: GetTickListRequestPacket): GetTickListRequest {
		assert(packet[0] === Opcode.GetTickList);
		return new GetTickListRequest(packet[1], packet[2], packet[3]);
	}
	public code: Opcode;
	public start: number;
	public end: number;
	public excludeEventFlags: ExcludeEventFlags;
	constructor(start: number, end: number, excludeEventFlags: ExcludeEventFlags) {
		this.code = Opcode.GetTickList;
		this.start = start;
		this.end = end;
		this.excludeEventFlags = excludeEventFlags;
	}
	public toPacket(): GetTickListRequestPacket {
		return [this.code, this.start, this.end, this.excludeEventFlags];
	}
}

// PutStartPoint

export interface PutStartPointRequestPacket extends MessagePacket {
	1: amflow.StartPoint;
}

export class PutStartPointRequest implements Message {
	public static fromPacket(packet: PutStartPointRequestPacket): PutStartPointRequest {
		assert(packet[0] === Opcode.PutStartPoint);
		return new PutStartPointRequest(packet[1]);
	}
	public code: Opcode;
	public startPoint: amflow.StartPoint;
	constructor(startPoint: amflow.StartPoint) {
		this.code = Opcode.PutStartPoint;
		this.startPoint = startPoint;
	}
	public toPacket(): PutStartPointRequestPacket {
		return [this.code, this.startPoint];
	}
}

// GetStartPoint
// 互換性のため frame 指定, timestamp 指定を明確に分けている

export interface GetStartPointRequestPacket extends MessagePacket {
	1: { frame?: number };
}

export class GetStartPointRequest implements Message {
	public static fromPacket(packet: GetStartPointRequestPacket): GetStartPointRequest {
		assert(packet[0] === Opcode.GetStartPoint);
		return new GetStartPointRequest(packet[1]);
	}
	public code: Opcode;
	public opts: { frame?: number };
	constructor(opts: { frame?: number }) {
		this.code = Opcode.GetStartPoint;
		this.opts = opts;
	}
	public toPacket(): GetStartPointRequestPacket {
		return [this.code, this.opts];
	}
}

export interface GetStartPointByTimestampRequestPacket extends MessagePacket {
	1: { timestamp?: number };
}

export class GetStartPointByTimestampRequest implements Message {
	public static fromPacket(packet: GetStartPointByTimestampRequestPacket): GetStartPointByTimestampRequest {
		assert(packet[0] === Opcode.GetStartPoint);
		return new GetStartPointByTimestampRequest(packet[1]);
	}
	public code: Opcode;
	public opts: { timestamp?: number };
	constructor(opts: { timestamp?: number }) {
		this.code = Opcode.GetStartPoint;
		this.opts = opts;
	}
	public toPacket(): GetStartPointByTimestampRequestPacket {
		return [this.code, this.opts];
	}
}

// PutStorageData

export interface PutStorageDataRequestPacket extends MessagePacket {
	1: playlog.StorageKey;
	2: playlog.StorageValue;
	3: any;
}

export class PutStorageDataRequest implements Message {
	public static fromPacket(packet: PutStorageDataRequestPacket): PutStorageDataRequest {
		assert(packet[0] === Opcode.PutStorageData);
		return new PutStorageDataRequest(packet[1], packet[2], packet[3]);
	}
	public code: Opcode;
	public key: playlog.StorageKey;
	public value: playlog.StorageValue;
	public opts: any;
	constructor(key: playlog.StorageKey, value: playlog.StorageValue, opts: any) {
		this.code = Opcode.PutStorageData;
		this.key = key;
		this.value = value;
		this.opts = opts;
	}
	public toPacket(): PutStorageDataRequestPacket {
		return [this.code, this.key, this.value, this.opts];
	}
}

// GetStorageData

export interface GetStorageDataRequestPacket extends MessagePacket {
	1: playlog.StorageKey[];
}

export class GetStorageDataRequest implements Message {
	public static fromPacket(packet: GetStorageDataRequestPacket): GetStorageDataRequest {
		assert(packet[0] === Opcode.GetStorageData);
		return new GetStorageDataRequest(packet[1]);
	}
	public code: Opcode;
	public keys: playlog.StorageReadKey[];
	constructor(keys: playlog.StorageReadKey[]) {
		this.code = Opcode.GetStorageData;
		this.keys = keys;
	}
	public toPacket(): GetStorageDataRequestPacket {
		return [this.code, this.keys];
	}
}

const requestClasses: { [code: number]: any } = {};
requestClasses[Opcode.Open] = OpenRequest;
requestClasses[Opcode.Authenticate] = AuthenticateRequest;
requestClasses[Opcode.Close] = CloseRequest;
requestClasses[Opcode.GetTickList] = GetTickListRequest;
requestClasses[Opcode.PutStartPoint] = PutStartPointRequest;
requestClasses[Opcode.GetStartPoint] = GetStartPointRequest;
requestClasses[Opcode.PutStorageData] = PutStorageDataRequest;
requestClasses[Opcode.GetStorageData] = GetStorageDataRequest;

function fromPacket(packet: MessagePacket): Message {
	const requestClass: MessageStatic = requestClasses[packet[0]];
	if (!requestClass) {
		throw new Error(`Invalid event type: ${packet[0]}`);
	}
	return requestClass.fromPacket(packet) as Message;
}

// msgpack-lite の extension type は無効にする
const msgpackCodec = msgpack.createCodec();

export function encode(request: Message): Buffer {
	return msgpack.encode(request.toPacket(), { codec: msgpackCodec });
}

export function decode(bytes: Buffer): Message {
	const packet: MessagePacket = msgpack.decode(bytes, { codec: msgpackCodec });
	return fromPacket(packet);
}

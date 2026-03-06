import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import assert from "assert";
import * as msgpack from "msgpack-lite";

import { sizeOfArrayHeader, writeArrayHeader } from "./encodeUtil";
import { Message, MessagePacket, MessageStatic } from "./Message";
import { EncodedOpcode, Opcode } from "./Opcode";

// msgpack-lite の extension type を無効にするためのcodec
const msgpackCodec = msgpack.createCodec();

export type ResponseError = {
	name: string;
	message?: string;
} | null;

// Open

export interface OpenResponsePacket extends MessagePacket {
	1: ResponseError;
}

export class OpenResponse implements Message {
	public static fromPacket(packet: OpenResponsePacket): OpenResponse {
		assert(packet[0] === Opcode.Open);
		return new OpenResponse(packet[1]);
	}
	public code: Opcode;
	public error: ResponseError;
	constructor(error?: ResponseError) {
		this.code = Opcode.Open;
		this.error = error || null;
	}
	public toPacket(): OpenResponsePacket {
		return [this.code, this.error];
	}
}

// Authenticate

export interface AuthenticateResponsePacket extends MessagePacket {
	1: ResponseError;
	2: amflow.Permission | null;
}

export class AuthenticateResponse implements Message {
	public static fromPacket(packet: AuthenticateResponsePacket): AuthenticateResponse {
		assert(packet[0] === Opcode.Authenticate);
		return new AuthenticateResponse(packet[1], packet[2]);
	}
	public code: Opcode;
	public error: ResponseError;
	public permission: amflow.Permission | null;
	constructor(error: ResponseError, permission?: amflow.Permission | null) {
		this.code = Opcode.Authenticate;
		this.error = error;
		this.permission = permission || null;
	}
	public toPacket(): AuthenticateResponsePacket {
		return [this.code, this.error, this.permission];
	}
}

// Close

export interface CloseResponsePacket extends MessagePacket {
	1: ResponseError;
}

export class CloseResponse implements Message {
	public static fromPacket(packet: CloseResponsePacket): CloseResponse {
		assert(packet[0] === Opcode.Close);
		return new CloseResponse(packet[1]);
	}
	public code: Opcode;
	public error: ResponseError;
	constructor(error?: ResponseError) {
		this.code = Opcode.Close;
		this.error = error || null;
	}
	public toPacket(): CloseResponsePacket {
		return [this.code, this.error];
	}
}

// GetTickList

export type GetTickListResponsePacket =
	| (MessagePacket & {
			1: ResponseError | null;
			2: number; // from
			3: number; // to
			4: playlog.Tick[];
	  })
	| (MessagePacket & {
			1: ResponseError | null;
	  });

export class GetTickListResponse implements Message {
	// エンコード済みのtick列から、エンコード済みパケットを直接組み立てる高速化用パス
	public static createEncodedDirect(rawTicks: Buffer[]): Buffer {
		if (rawTicks.length === 0) {
			return Buffer.from([
				0x92, // Array(2)
				EncodedOpcode.GetTickList,
				0xc0, // 0xc0 (nil)
			]);
		}
		const rawEventTicks: Buffer[] = [];
		let ticksSize = 0;
		for (let i = 0; i < rawTicks.length; ++i) {
			const t = rawTicks[i];
			if (
				t[0] === 0x91 || // 1要素配列([age])
				(t[0] & 0xf0) !== 0x90
			) {
				// 0x90-0x9f(15要素以下配列)でない＝age(を表すnumber)のティック
				continue;
			}
			// 理想的には、ティックの第一・第二要素(イベントとストレージデータ)が
			// null(0xc0)、空配列(0x90)または存在しない場合も除外すべきである。(e.g. [age, []], [age, null, []])
			// しかしこの箇所の条件分岐を煩雑にしてまでやる意義は薄い(正常系ではまず生じないかつ見逃しても数バイト)。
			// きちんと対応するなら書き込み時に正規化すべき。
			ticksSize += t.length;
			rawEventTicks.push(t);
		}
		const fromTick = msgpack.decode(rawTicks[0], { codec: msgpackCodec }) as playlog.Tick;
		const toTick = msgpack.decode(rawTicks[rawTicks.length - 1], { codec: msgpackCodec }) as playlog.Tick;
		const from = msgpack.encode(typeof fromTick === "number" ? fromTick : fromTick[0], { codec: msgpackCodec });
		const to = msgpack.encode(typeof toTick === "number" ? toTick : toTick[0], { codec: msgpackCodec });
		const hasEventTicks = rawEventTicks.length > 0;

		const buf = Buffer.alloc(
			1 + // 0x95 (Array(5)) or 0x94 (Array(4))
				1 + // 0x04 (EncodedOpCode.GetTickList)
				1 + // 0xc0 (nil)
				from.length +
				to.length +
				(hasEventTicks ? sizeOfArrayHeader(rawEventTicks.length) + ticksSize : 0),
		);
		let offset = 0;
		buf[offset++] = hasEventTicks ? 0x95 : 0x94; // Array(5) or Array(4)
		buf[offset++] = EncodedOpcode.GetTickList;
		buf[offset++] = 0xc0; // nil
		offset += from.copy(buf, offset);
		offset += to.copy(buf, offset);
		if (hasEventTicks) {
			offset = writeArrayHeader(buf, offset, rawEventTicks.length); // Array(rawEventTicks.length)
			for (let i = 0; i < rawEventTicks.length; ++i) {
				offset += rawEventTicks[i].copy(buf, offset);
			}
		}
		return buf;
	}

	public static fromPacket(packet: GetTickListResponsePacket): GetTickListResponse {
		assert(packet[0] === Opcode.GetTickList);
		if (packet.length === 2) {
			return new GetTickListResponse(packet[1]);
		}
		const tickList: playlog.TickList = [packet[2], packet[3]];
		if (packet[4]) {
			tickList.push(packet[4]);
		}
		return new GetTickListResponse(packet[1], tickList);
	}
	public code: Opcode;
	public error: ResponseError;
	public tickList: playlog.TickList | null;
	constructor(error: ResponseError, tickList?: playlog.TickList | null) {
		this.code = Opcode.GetTickList;
		this.error = error;
		this.tickList = tickList || null;
	}
	public toPacket(): GetTickListResponsePacket {
		if (!this.tickList) {
			return [this.code, this.error];
		}
		const from = this.tickList[0];
		const to = this.tickList[1];
		const packet: GetTickListResponsePacket = [this.code, this.error, from, to];
		if (this.tickList[2] && this.tickList[2].length) {
			packet[4] = this.tickList[2];
		}
		return packet;
	}
}

// PutStartPoint

export interface PutStartPointResponsePacket extends MessagePacket {
	1: ResponseError;
}

export class PutStartPointResponse implements Message {
	public static fromPacket(packet: PutStartPointResponsePacket): PutStartPointResponse {
		assert(packet[0] === Opcode.PutStartPoint);
		return new PutStartPointResponse(packet[1]);
	}
	public code: Opcode;
	public error: ResponseError;
	constructor(error?: ResponseError) {
		this.code = Opcode.PutStartPoint;
		this.error = error || null;
	}
	public toPacket(): PutStartPointResponsePacket {
		return [this.code, this.error];
	}
}

// GetStartPoint

export interface GetStartPointResponsePacket extends MessagePacket {
	1: ResponseError;
	2: amflow.StartPoint | null;
}

export class GetStartPointResponse implements Message {
	public static fromPacket(packet: GetStartPointResponsePacket): GetStartPointResponse {
		assert(packet[0] === Opcode.GetStartPoint);
		return new GetStartPointResponse(packet[1], packet[2]);
	}
	public code: Opcode;
	public error: ResponseError;
	public startPoint: amflow.StartPoint | null;
	constructor(error: ResponseError, startPoint?: amflow.StartPoint | null) {
		this.code = Opcode.GetStartPoint;
		this.error = error;
		this.startPoint = startPoint || null;
	}
	public toPacket(): GetStartPointResponsePacket {
		return [this.code, this.error, this.startPoint];
	}
}

// PutStorageData

export interface PutStorageDataResponsePacket extends MessagePacket {
	1: ResponseError;
}

export class PutStorageDataResponse implements Message {
	public static fromPacket(packet: PutStorageDataResponsePacket): PutStorageDataResponse {
		assert(packet[0] === Opcode.PutStorageData);
		return new PutStorageDataResponse(packet[1]);
	}
	public code: Opcode;
	public error: ResponseError;
	constructor(error?: ResponseError) {
		this.code = Opcode.PutStorageData;
		this.error = error || null;
	}
	public toPacket(): PutStorageDataResponsePacket {
		return [this.code, this.error];
	}
}

// GetStorageData

export interface GetStorageDataResponsePacket extends MessagePacket {
	1: ResponseError;
	2: playlog.StorageData[] | null;
}

export class GetStorageDataResponse implements Message {
	public static fromPacket(packet: GetStorageDataResponsePacket): GetStorageDataResponse {
		assert(packet[0] === Opcode.GetStorageData);
		return new GetStorageDataResponse(packet[1], packet[2]);
	}
	public code: Opcode;
	public error: ResponseError;
	public storageData: playlog.StorageData[] | null;
	constructor(error: ResponseError, storageData?: playlog.StorageData[] | null) {
		this.code = Opcode.GetStorageData;
		this.error = error;
		this.storageData = storageData || null;
	}
	public toPacket(): GetStorageDataResponsePacket {
		return [this.code, this.error, this.storageData];
	}
}

const responseClasses: { [code: number]: any } = {};
responseClasses[Opcode.Open] = OpenResponse;
responseClasses[Opcode.Authenticate] = AuthenticateResponse;
responseClasses[Opcode.Close] = CloseResponse;
responseClasses[Opcode.GetTickList] = GetTickListResponse;
responseClasses[Opcode.PutStartPoint] = PutStartPointResponse;
responseClasses[Opcode.GetStartPoint] = GetStartPointResponse;
responseClasses[Opcode.PutStorageData] = PutStorageDataResponse;
responseClasses[Opcode.GetStorageData] = GetStorageDataResponse;

export function fromPacket(packet: MessagePacket): Message {
	const responseClass: MessageStatic = responseClasses[packet[0]];
	if (!responseClass) {
		throw new Error(`Invalid event type: ${packet[0]}`);
	}
	return responseClass.fromPacket(packet) as Message;
}

export function encode(response: Message): Buffer {
	return msgpack.encode(response.toPacket(), { codec: msgpackCodec });
}

export function decode(bytes: Buffer): Message {
	const packet: MessagePacket = msgpack.decode(bytes, { codec: msgpackCodec });
	return fromPacket(packet);
}

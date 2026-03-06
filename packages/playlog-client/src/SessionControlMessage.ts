// TODO: playlog-server-engineと同じファイル。モジュールとして分離予定。

export enum ControlCode {
	Establish,
	Validate,
}

export interface Packet {
	code: ControlCode;
	body: any;
}

export interface Message {
	code: ControlCode;
	toBytes(): Buffer;
}

export class EstablishRequestMessage implements Message {
	public code: ControlCode;
	constructor() {
		this.code = ControlCode.Establish;
	}
	public toBytes(): Buffer {
		const data = { code: this.code };
		return Buffer.from(JSON.stringify(data));
	}
}

export class ValidateRequestMessage implements Message {
	public code: ControlCode;
	public playId: string;
	public token: string;
	constructor(playId: string, token: string) {
		this.code = ControlCode.Validate;
		this.playId = playId;
		this.token = token;
	}
	public toBytes(): Buffer {
		const p: Packet = { code: this.code, body: { playId: this.playId, token: this.token } };
		return Buffer.from(JSON.stringify(p));
	}
}

export class EstablishResponseMessage implements Message {
	public code: ControlCode;
	public uid: string;
	constructor(uid: string) {
		this.code = ControlCode.Establish;
		this.uid = uid;
	}
	public toBytes(): Buffer {
		const p: Packet = { code: this.code, body: { uid: this.uid } };
		return Buffer.from(JSON.stringify(p));
	}
}

export class ValidateResponseMessage implements Message {
	public code: ControlCode;
	public success: boolean;
	constructor(success: boolean) {
		this.code = ControlCode.Validate;
		this.success = success;
	}
	public toBytes(): Buffer {
		const p: Packet = { code: this.code, body: { success: this.success } };
		return Buffer.from(JSON.stringify(p));
	}
}

function toPacket(bytes: Buffer): Packet {
	let packet: Packet = null;
	try {
		packet = JSON.parse(bytes.toString());
	} catch (e) {
		return null;
	}
	return packet;
}

export function toRequestMessage(bytes: Buffer): Message {
	const packet = toPacket(bytes);
	if (!packet) {
		return;
	}
	switch (packet.code) {
		case ControlCode.Establish:
			return new EstablishRequestMessage();
		case ControlCode.Validate:
			return new ValidateRequestMessage(packet.body.playId, packet.body.token);
		default:
			return null;
	}
}

export function toResponseMessage(bytes: Buffer): Message {
	const packet = toPacket(bytes);
	if (!packet) {
		return;
	}
	switch (packet.code) {
		case ControlCode.Establish:
			return new EstablishResponseMessage(packet.body.uid);
		case ControlCode.Validate:
			return new ValidateResponseMessage(packet.body.success);
		default:
			return null;
	}
}

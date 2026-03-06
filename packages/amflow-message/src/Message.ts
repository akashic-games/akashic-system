import { Opcode } from "./Opcode";

export interface MessagePacket extends Array<any> {
	[index: number]: any;
	0: Opcode;
}

export interface MessageStatic {
	new (): Message;
	fromPacket(packet: MessagePacket): Message;
}

export interface Message {
	code: Opcode;
	toPacket(): any[];
}

export enum FrameIdentifier {
	Control,
	Data,
}

export enum ControlFrameType {
	Accept = 0x1,
	Deny = 0x2,
	Open = 0x3,
	Channel = 0x4,
	Pipe = 0x5,
	Close = 0x6,
	CloseChannel = 0x7,
	ClosePipe = 0x8,
	Error = 0x9,
}

export interface Frame {
	identifier: FrameIdentifier;
}

export interface ControlFrame extends Frame {
	type: ControlFrameType;
	id: number;
}

export interface AcceptControlFrame extends ControlFrame {
	data?: Buffer;
}

export interface DenyControlFrame extends ControlFrame {}

export interface OpenControlFrame extends ControlFrame {
	random: number;
	protocolVersion: number;
	protocolIdentifier: number;
}

export interface CloseControlFrame extends ControlFrame {}

export interface PipeControlFrame extends ControlFrame {
	primary: boolean;
	channelId: number;
	request: boolean;
	pipeId: number;
	label: string;
}

export interface ClosePipeControlFrame extends ControlFrame {
	channelId: number;
	pipeId: number;
	request: boolean;
}

export interface ChannelControlFrame extends ControlFrame {
	primary: boolean;
	channelId: number;
	label: string;
}

export interface CloseChannelControlFrame extends ControlFrame {
	channelId: number;
}

export interface DataFrame extends Frame {
	primaryChannel: boolean;
	primaryPipe: boolean;
	request: boolean;
	channelId?: number;
	pipeId?: number;
	requestId?: number;
	payload: Buffer;
}

export function createDenyControlFrame(id: number): DenyControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Deny,
		id,
	};
}

export function createAcceptControlFrame(id: number, data?: Buffer): AcceptControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Accept,
		id,
		data,
	};
}

export function createPipeControlFrame(
	id: number,
	primary: boolean,
	request: boolean,
	channelId: number,
	pipeId: number,
	label: string,
): PipeControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Pipe,
		id,
		channelId,
		primary,
		pipeId,
		request,
		label,
	};
}

export function createClosePipeControlFrame(id: number, channelId: number, pipeId: number, request: boolean): ClosePipeControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.ClosePipe,
		id,
		channelId,
		pipeId,
		request,
	};
}

export function createChannelControlFrame(id: number, primary: boolean, channelId: number, label: string): ChannelControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Channel,
		id,
		primary,
		channelId,
		label,
	};
}

export function createCloseChannelControlFrame(id: number, channelId: number): CloseChannelControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.CloseChannel,
		id,
		channelId,
	};
}

export function createOpenControlFrame(id: number, random: number, version: number, identifier: number): OpenControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Open,
		id,
		protocolVersion: version,
		protocolIdentifier: identifier,
		random,
	};
}

export function createCloseControlFrame(id: number): CloseControlFrame {
	return {
		identifier: FrameIdentifier.Control,
		type: ControlFrameType.Close,
		id,
	};
}

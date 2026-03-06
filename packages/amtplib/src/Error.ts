export class ProtocolError implements Error {
	public message: string;
	public name: string;
	public cause: any;
	constructor(name?: string, message?: string, cause?: any) {
		this.name = name;
		this.message = message;
		this.cause = cause;
	}
}

export class PureVirtualError extends ProtocolError {
	constructor() {
		super("PureVirtualError", "Sub class must implement");
	}
}

export class RequestDeniedError extends ProtocolError {
	constructor() {
		super("RequestDeniedError", "Request denied by peer");
	}
}

export class InvalidFrameError extends ProtocolError {
	constructor(message: string) {
		super("InvalidFrameError", message);
	}
}

export class UnexpectedFrameError extends ProtocolError {
	constructor(message: string) {
		super("UnexpectedFrameError", message);
	}
}

export class InvalidStateError extends ProtocolError {
	constructor(message: string) {
		super("InvalidStateError", message);
	}
}

export class SocketError extends ProtocolError {
	constructor(cause?: any) {
		super("SocketError", "Socket error occurred");
		this.cause = cause;
	}
}

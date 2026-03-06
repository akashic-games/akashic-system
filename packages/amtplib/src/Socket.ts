export interface Socket {
	send(data: Buffer): void;
	recv(handler: (data: Buffer) => void): void;
}

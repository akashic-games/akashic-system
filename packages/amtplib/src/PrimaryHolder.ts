/**
 * Holds the primary channel/pipes id send and receive.
 */
export class PrimaryHolder<T> {
	public send: T;
	public recv: T;
	constructor() {
		this.send = null;
		this.recv = null;
	}
	public set(send: T, recv: T): void {
		this.send = send;
		this.recv = recv;
	}
	public setSend(p: T): void {
		this.send = p;
	}
	public setRecv(p: T): void {
		this.recv = p;
	}
}

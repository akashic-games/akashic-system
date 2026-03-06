import * as uuid from "node-uuid";
import { EventLike } from "./EventLike";

export class Event<T> implements EventLike<T> {
	public static fromBuffer<T>(content: Buffer): Event<T> {
		const json: EventLike<T> = JSON.parse(content.toString("utf8"));
		return new Event(json);
	}

	public readonly id: string;
	public readonly category: string;
	public readonly type: string;
	public readonly payload?: T;

	constructor(event: EventLike<T>) {
		this.id = event.id ? event.id : uuid.v4();
		this.category = event.category;
		this.type = event.type;
		this.payload = event.payload;
	}

	public toJSON() {
		const result: EventLike<T> = {
			id: this.id,
			category: this.category,
			type: this.type,
		};
		if (this.payload) {
			result.payload = this.payload;
		}
		return result;
	}

	public toBuffer() {
		return Buffer.from(JSON.stringify(this.toJSON()));
	}
}

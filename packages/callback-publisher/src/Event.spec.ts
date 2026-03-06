import { Event } from "./Event";
import { EventCategory } from "./EventCategory";

describe("EventEvent", () => {
	it("Bufferと相互変換できる", () => {
		const event = new Event({
			category: EventCategory.Info,
			type: "instanceStatus",
		});
		const actual = Event.fromBuffer(event.toBuffer());
		expect(actual.id).toEqual(event.id);
		expect(actual.category).toEqual(event.category);
		expect(actual.type).toEqual(event.type);
	});
});

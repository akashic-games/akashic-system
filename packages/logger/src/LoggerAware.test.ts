import { LogLevel } from "./Appender";
import { LoggerAware, LoggerAwareTrait } from "./LoggerAware";
import { TestLogger } from "./TestLogger";

test("base on empty class", async () => {
	// tslint:disable-next-line:max-classes-per-file
	class Target extends LoggerAware {
		public async double(name: string): Promise<string> {
			await this.logger.debug(name, new Map());
			return name.repeat(2);
		}
	}

	const target = new Target();
	target.logger = new TestLogger();
	expect((target.logger as TestLogger).hasRecords(LogLevel.DEBUG)).toBe(false);

	await target.double("bar");

	expect(
		(target.logger as TestLogger).hasRecord({
			message: "bar",
			level: LogLevel.DEBUG,
			context: new Map(),
		}),
	).toBe(true);
});

test("loggable trait basic usage (without class decorator syntax)", async () => {
	// tslint:disable-next-line:max-classes-per-file
	class Base {
		public double(name: string): string {
			return name.repeat(2);
		}
	}

	// tslint:disable-next-line:max-classes-per-file
	class Target extends LoggerAwareTrait(Base) {
		public double(name: string): string {
			// 投げっぱなしにする
			this.logger.debug(name, new Map());

			return super.double(name);
		}
	}

	const target = new Target();
	target.logger = new TestLogger();
	expect((target.logger as TestLogger).hasRecords(LogLevel.DEBUG)).toBe(false);

	await target.double("foo");

	expect(
		(target.logger as TestLogger).hasRecord({
			message: "foo",
			level: LogLevel.DEBUG,
			context: new Map(),
		}),
	).toBe(true);
});

/*
// class decorator の戻り値の型が解決できるようになったら、このテストケースのような使い方ができる
test("loggable trait basic usage (with class decorator syntax)", async () => {
	// tslint:disable-next-line:max-classes-per-file
	@LoggerAwareTrait
	class Loggable {
		public async double(name: string): Promise<string> {
			await this.logger.debug(name);
			return name.repeat(2);
		}
	}

	const target = new Loggable();
	target.logger = new TestLogger();
	expect((target.logger as TestLogger).hasRecords(LogLevel.DEBUG)).toBe(false);

	await target.double("foo");

	expect(
		(target.logger as TestLogger).hasRecord({
			message: "foo",
			level: LogLevel.DEBUG,
			context: new Map(),
		})
	).toBe(true);
});
*/

import { NullAppender } from "./NullAppender";
import { LogLevel } from "./LogLevel";

test("NullAppender.append should return true", async () => {
	const appender = new NullAppender();

	const actual = await appender.append({ message: "", level: LogLevel.INFO });
	expect(actual).toBe(true);
});

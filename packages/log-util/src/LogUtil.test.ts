import * as log4js from "log4js";
import { LogUtil } from "./";

import * as del from "del";
import * as path from "path";
import AuxMock from "./AuxMock";

del.sync([path.join(__dirname, "out/*")]);

const log4jsConf: log4js.Configuration = {
	appenders: {
		out: { type: "console" },
		file: {
			type: "file",
			filename: path.join(__dirname, "out/test.log"),
			layout: { type: "basic" },
		},
	},
	categories: {
		default: { appenders: ["out"], level: "trace" },
		test: { appenders: ["file"], level: "trace" },
	},
};
log4js.configure(log4jsConf);

describe("LogUtil", () => {
	it("can output log like as log4js", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"));

		logger.trace("this is %s log.", "trace");
		logger.debug("this is %s log.", "debug");
		logger.info("this is %s log.", "info");
		logger.warn("this is %s log.", "warn");
		logger.error("this is %s log.", "error");
		logger.fatal("this is %s log.", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can be constructed with auxiliary info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { a: true, b: 42, c: "foo" });

		logger.trace("%s log with aux info of logger.", "trace");
		logger.debug("%s log with aux info of logger.", "debug");
		logger.info("%s log with aux info of logger.", "info");
		logger.warn("%s log with aux info of logger.", "warn");
		logger.error("%s log with aux info of logger.", "error");
		logger.fatal("%s log with aux info of logger.", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can be set auxiliary info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { setByMethod: false, a: true, b: 42, c: "foo" });

		logger.setAuxInfo({ setByMethod: true, a: false, b: 24, c: "bar" });
		logger.info("info log with aux info of logger.");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("auxiliary info won't bubble up", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { setByMethod: false, a: true, b: 42, c: "foo" });
		const aux = new AuxMock();

		logger.setAuxInfo(aux);
		logger.info("info log with aux info of logger.");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output log with auxiliary info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { logWithAux: "true" });

		logger.traceWithAux("trace log with aux info.", { type: "trace" });
		logger.debugWithAux("debug log with aux info.", { type: "debug" });
		logger.infoWithAux("info log with aux info.", { type: "info" });
		logger.warnWithAux("warn log with aux info.", { type: "warn" });
		logger.errorWithAux("error log with aux info.", { type: "error" });
		logger.fatalWithAux("fatal log with aux info.", { type: "fatal" });

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("auxiliary info won't bubble up that auxiliary given withAux methods", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { logWithAux: "true" });
		const aux = new AuxMock();

		logger.traceWithAux("trace log with aux info.", aux);

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output log with error and stack trace", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { logWithError: "true" });
		const error: Error = new Error("dummy error");

		logger.trace("trace log with error.", error);
		logger.debug("debug log with error.", error);
		logger.info("info log with error.", error);
		logger.warn("warn log with error.", error);
		logger.error("error log with error.", error);
		logger.fatal("fatal log with error.", error);

		logger.traceWithAux("trace log with error and aux info.", { type: "trace" }, error);
		logger.debugWithAux("debug log with error and aux info.", { type: "debug" }, error);
		logger.infoWithAux("info log with error and aux info.", { type: "info" }, error);
		logger.warnWithAux("warn log with error and aux info.", { type: "warn" }, error);
		logger.errorWithAux("error log with error and aux info.", { type: "error" }, error);
		logger.fatalWithAux("fatal log with error and aux info.", { type: "fatal" }, error);

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output start event log", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "start" });

		logger.traceStart("doSomething", "log %s event as %s.", "start", "trace");
		logger.debugStart("doSomething", "log %s event as %s.", "start", "debug");
		logger.infoStart("doSomething", "log %s event as %s.", "start", "info");
		logger.warnStart("doSomething", "log %s event as %s.", "start", "warn");
		logger.errorStart("doSomething", "log %s event as %s.", "start", "error");
		logger.fatalStart("doSomething", "log %s event as %s.", "start", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output start event log with aux info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "start" });

		logger.traceStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "trace");
		logger.debugStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "debug");
		logger.infoStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "info");
		logger.warnStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "warn");
		logger.errorStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "error");
		logger.fatalStartWithAux("doSomething", "log %s event as %s.", { withAux: true }, "start", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output end event log", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "end" });

		logger.traceEnd("doSomething", "log %s event as %s.", "end", "trace");
		logger.debugEnd("doSomething", "log %s event as %s.", "end", "debug");
		logger.infoEnd("doSomething", "log %s event as %s.", "end", "info");
		logger.warnEnd("doSomething", "log %s event as %s.", "end", "warn");
		logger.errorEnd("doSomething", "log %s event as %s.", "end", "error");
		logger.fatalEnd("doSomething", "log %s event as %s.", "end", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output end event log with aux info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "end" });

		logger.traceEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "trace");
		logger.debugEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "debug");
		logger.infoEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "info");
		logger.warnEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "warn");
		logger.errorEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "error");
		logger.fatalEndWithAux("doSomething", "log %s event as %s.", { withAux: true }, "end", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output abort event log", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "abort" });

		logger.traceAbort("doSomething", "log %s event as %s.", "abort", "trace");
		logger.debugAbort("doSomething", "log %s event as %s.", "abort", "debug");
		logger.infoAbort("doSomething", "log %s event as %s.", "abort", "info");
		logger.warnAbort("doSomething", "log %s event as %s.", "abort", "warn");
		logger.errorAbort("doSomething", "log %s event as %s.", "abort", "error");
		logger.fatalAbort("doSomething", "log %s event as %s.", "abort", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});

	it("can output abort event log with aux info", () => {
		const logger: LogUtil = new LogUtil(log4js.getLogger("test"), { testEvent: "abort" });

		logger.traceAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "trace");
		logger.debugAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "debug");
		logger.infoAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "info");
		logger.warnAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "warn");
		logger.errorAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "error");
		logger.fatalAbortWithAux("doSomething", "log %s event as %s.", { withAux: true }, "abort", "fatal");

		expect(true).toBe(true); // エラーなくここまで到達できれば良い。
	});
});

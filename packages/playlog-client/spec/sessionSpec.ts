import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import { Session, Socket } from "./";

const SOCKET_TYPE = Socket.Type.WebSocket;
const URL = "ws://" + location.host;

describe("Session", () => {
	let originalTimeout: number;
	beforeEach(() => {
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30 * 1000;
	});

	afterEach(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});

	it("open and close", (done) => {
		const s = new Session(URL, { socketType: SOCKET_TYPE });
		s.open((error) => {
			if (error) {
				done.fail(error);
			}
			s.close(done);
		});
	});
	it("open with validation", (done) => {
		const validationData = {
			playId: "session-success",
			token: "foo",
		};
		const s = new Session(URL, { socketType: SOCKET_TYPE, validationData });
		s.open((error) => {
			if (error) {
				return done.fail(error);
			}
			s.close(done);
		});
	});
	it("failed to validation", (done) => {
		const validationData = {
			playId: "session-fail",
			token: "foo",
		};
		const s = new Session(URL, { socketType: SOCKET_TYPE, validationData });
		s.open((error) => {
			if (error) {
				return done();
			}
			s.close(done.fail);
		});
	});
});

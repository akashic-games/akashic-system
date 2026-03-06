import { EventEmitter } from "events";
import * as RealZooKeeper from "zookeeper";

export class MockZooKeeper extends EventEmitter {
	public static ZOO_EPHEMERAL = RealZooKeeper.constants.ZOO_EPHEMERAL;
	public static ZOO_SEQUENCE = RealZooKeeper.constants.ZOO_SEQUENCE;
	public static ZNODEEXISTS = RealZooKeeper.constants.ZNODEEXISTS;
	public static ZCONNECTIONLOSS = RealZooKeeper.constants.ZCONNECTIONLOSS;

	public connect(opts, callback) {
		if (typeof opts === "function") {
			callback = opts;
			opts = null;
		}

		process.nextTick(() => {
			this.emit("connect");
			callback();
		});
	}

	public close() {
		process.nextTick(() => {
			this.emit("close");
		});
	}
}

export class MockZooKeeperPromise extends MockZooKeeper {
	public on_connected() {
		return new Promise((resolve, reject) => {
			this.once("connect", () => {
				resolve(this);
			});
		});
	}

	public create() {
		return Promise.resolve("");
	}

	public delete_() {
		return Promise.resolve();
	}

	public mkdirp(path, callback) {
		callback();
	}

	public get() {
		return Promise.resolve([{ createdInThisSession: true }]);
	}
}

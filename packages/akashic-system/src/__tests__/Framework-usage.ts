import { ApplicationBase } from "../";

test("Application class implementation example", async () => {
	class ConcreteApplication extends ApplicationBase {
		public async initialize(): Promise<ConcreteApplication> {
			this.status = "initialized";
			return this;
		}

		public async boot(): Promise<ConcreteApplication> {
			this.status = "running";
			return this;
		}

		public async terminate(): Promise<ConcreteApplication> {
			this.status = "terminated";
			return this;
		}
	}

	const app = new ConcreteApplication();

	await app.initialize();
	expect(app.status).toBe("initialized");

	await app.boot();
	expect(app.status).toBe("running");

	await app.terminate();
	expect(app.status).toBe("terminated");
});

import { ApplicationStatus, IApplication } from "./Application";

export abstract class ApplicationBase implements IApplication {
	private statusRaw: ApplicationStatus = "created";

	public get status(): ApplicationStatus {
		return this.statusRaw;
	}

	public set status(newStatus: ApplicationStatus) {
		// 本当は、 protected set status() にしたいのだけれど、
		// Java 的に言うところの package スコープにしたいのだけれど、そういうことができないので、
		// 最低限、呼び出しに対して Cut Point を入れられるように Setter を経由させる
		this.statusRaw = newStatus;
	}

	public abstract boot(): Promise<IApplication>;

	public abstract initialize(): Promise<IApplication>;

	public abstract terminate(): Promise<IApplication>;
}

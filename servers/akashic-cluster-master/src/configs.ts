export interface Process {
	acceptPort: number;
}

export interface Timeout {
	default: number;
	assignGame: number;
}
export interface Master {
	maxGameAssignTime: number;
}
export interface AppConfig {
	process: Process;
	master: Master;
}

export interface RabbitMQConfig {
	url: string | string[];
	user: string;
	passwd: string;
}

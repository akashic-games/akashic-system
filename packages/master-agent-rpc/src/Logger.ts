export interface Logger {
	error(message: string, ...obj: any[]): void;
	warn(message: string, ...obj: any[]): void;
}

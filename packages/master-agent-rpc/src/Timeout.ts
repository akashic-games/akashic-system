class TimeoutMarker {}

export default function Timeout<T>(target: PromiseLike<T>, timeout: number, timeoutMessage: string, onTimeout: () => void): Promise<T> {
	return Promise.race<T | TimeoutMarker>([target, new Promise((resolve) => setTimeout(() => resolve(new TimeoutMarker()), timeout))]).then(
		(result) => {
			if (result instanceof TimeoutMarker) {
				onTimeout();
				return Promise.reject(new Error(timeoutMessage));
			}
			return Promise.resolve<T>(<T>result);
		},
	);
}

import { ReadyState } from "./ReadyState";

// bad name
export function detectOpenStatusMinimumId(targets: { [id: number]: { readyState: ReadyState } }): number {
	const sorted = Object.keys(targets).sort((a, b) => {
		if (a < b) {
			return -1;
		}
		if (a > b) {
			return 1;
		}
		return 0;
	});
	for (let i = 0; i < sorted.length; i++) {
		const id = Number(sorted[i]);
		if (targets[id].readyState === ReadyState.Open) {
			return id;
		}
	}
	return null;
}

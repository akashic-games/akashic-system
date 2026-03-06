import * as playlog from "@akashic/playlog";

export function fromTicks(ticks: playlog.Tick[]): playlog.TickList | null {
	if (!ticks.length) {
		return null;
	}
	const from = ticks[0][0];
	const to = ticks[ticks.length - 1][0];
	const eventTicks: playlog.Tick[] = [];
	for (let i = 0, len = ticks.length; i < len; i++) {
		const tick = ticks[i];
		if ((tick[1] && tick[1].length) || (tick[2] && tick[2].length)) {
			eventTicks.push(tick);
		}
	}
	if (eventTicks.length) {
		return [from, to, eventTicks];
	} else {
		return [from, to];
	}
}

export function toTicks(tickList: playlog.TickList | null): playlog.Tick[] {
	if (!tickList) {
		return [];
	}
	const from = tickList[0];
	const to = tickList[1];
	const eventTicks = tickList[2] || [];
	const tickMap: { [frame: string]: playlog.Tick } = {};
	for (let i = 0; i < eventTicks.length; i++) {
		// deserialize packets which have events.
		const t = eventTicks[i];
		tickMap[t[0]] = t;
	}
	const resultTicks: playlog.Tick[] = [];
	for (let frame = from; frame <= to; frame++) {
		// complete packets which have no events.
		resultTicks.push(tickMap[frame] || [frame]);
	}
	return resultTicks;
}

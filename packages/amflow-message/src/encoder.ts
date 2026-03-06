// TODO: 別モジュールに切り出す

import * as amflow from "@akashic/amflow";
import * as playlog from "@akashic/playlog";
import * as msgpack from "msgpack-lite";

// msgpack-lite の extension type は無効にする
const msgpackCodec = msgpack.createCodec();

export function encodeEvent(event: playlog.Event): Buffer {
	return msgpack.encode(event, { codec: msgpackCodec });
}

export function decodeEvent(bytes: Buffer): playlog.Event {
	return msgpack.decode(bytes, { codec: msgpackCodec });
}

export function encodeTick(tick: playlog.Tick): Buffer {
	if ((tick[1] && tick[1].length) || (tick[2] && tick[2].length)) {
		return msgpack.encode(tick, { codec: msgpackCodec });
	} else {
		return msgpack.encode(tick[0], { codec: msgpackCodec });
	}
}

export function decodeTick(bytes: Buffer): playlog.Tick {
	const encoded = msgpack.decode(bytes, { codec: msgpackCodec });
	if (typeof encoded === "number") {
		return [encoded];
	} else {
		return encoded;
	}
}

export function encodeStartPoint(startPoint: amflow.StartPoint): Buffer {
	return msgpack.encode(startPoint, { codec: msgpackCodec });
}

export function decodeStartPoint(bytes: Buffer): amflow.StartPoint {
	return msgpack.decode(bytes, { codec: msgpackCodec });
}

// MessagePack 仕様の必要な部分だけ置く。定数は MessagePack の仕様に基づく。

export function sizeOfArrayHeader(len: number): number {
	return len < 16 ? 1 : len < 65536 ? 3 : 5;
}

export function writeArrayHeader(buf: Buffer, offset: number, len: number): number {
	if (len < 16) {
		offset = buf.writeUInt8(0x90 + len, offset);
	} else if (len < 65536) {
		offset = buf.writeUInt8(0xdc, offset);
		offset = buf.writeUInt16BE(len, offset);
	} else {
		offset = buf.writeUInt8(0xdd, offset);
		offset = buf.writeUInt32BE(len, offset);
	}
	return offset;
}

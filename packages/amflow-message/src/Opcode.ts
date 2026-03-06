/**
 * request 用 operation code
 *
 * この enum 内の定義を変更する場合は、EncodedOpcode (msgpack エンコード後の値)の変更も必要である。
 * すでに encode 後のバイト数を 1 と仮定しているコードが存在しているため、0〜127 に収まる範囲の値を
 * 使用することが望ましく、それ以外の範囲を利用する場合は注意が必要である。
 */
export enum Opcode {
	Open = 0x1,
	Authenticate = 0x2,
	Close = 0x3,
	GetTickList = 0x4,
	PutStartPoint = 0x5,
	GetStartPoint = 0x6,
	PutStorageData = 0x7,
	GetStorageData = 0x8,
}

/**
 * 高速化用パスのための msgpack エンコード済み Opcode
 *
 * Opcode が 7bit positive integer の範囲であれば、Opcode と一致する。
 * @see https://github.com/msgpack/msgpack/blob/master/spec.md#int-format-family
 */
export enum EncodedOpcode {
	Open = Opcode.Open,
	Authenticate = Opcode.Authenticate,
	Close = Opcode.Close,
	GetTickList = Opcode.GetTickList,
	PutStartPoint = Opcode.PutStartPoint,
	GetStartPoint = Opcode.GetStartPoint,
	PutStorageData = Opcode.PutStorageData,
	GetStorageData = Opcode.GetStorageData,
}

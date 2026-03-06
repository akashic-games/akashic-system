import { map } from "./Annotations";

export class Test {
	@map()
	public id: string;
	@map()
	public foo: string;
	@map()
	public bar: number;
	@map()
	public baz: string;
}

export class InsertTest {
	@map()
	public id: string;
	@map()
	public fValue: string;
	@map()
	public fUniq: string;
}

export class TypeTest {
	@map()
	public fBigint: string;
	@map()
	public fTynyint: number;
	@map()
	public fSmallint: number;
	@map()
	public fMediumint: number;
	@map()
	public fInt: number;
	@map()
	public fsInt: string;
	@map()
	public fnBigint: string;
	@map()
	public fFloat: number;
	@map()
	public fDouble: number;
	@map()
	public fDate: Date;
	@map()
	public fDatetime: Date;
	@map()
	public fsDatetime: string;
	@map()
	public fnDatetime: Date;
	@map()
	public fTimestamp: Date;
	@map()
	public fTime: string;
	@map()
	public fYear: number;
	@map()
	public fChar: string;
	@map()
	public fVarchar: string;
	@map()
	public fBinary: Buffer;
	@map()
	public fVarbinary: Buffer;
	@map()
	public fBlob: Buffer;
	@map()
	public fText: string;
	@map()
	public fEnum: string;
}

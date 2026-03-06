/**
 * マーキングした対象をマッピング対象と示すannotation
 */
export function map(): (target: object, propertyKey: string | symbol) => any {
	return (_target: object, _propertyKey: string | symbol) => {
		// このアノテーション自体はmetadataのためだけに現状mapping対象であることを示すだけなので、何もしないアノテーションを返す
	};
}

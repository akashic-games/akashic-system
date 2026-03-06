export interface Page {
	page: number;
	current: boolean;
}

export interface PagenationInfo {
	pages: Page[];
	isFirstPage: boolean;
	isLastPage: boolean;
	previousPage: number;
	nextPage: number;
}

/**
 * ページネーション表示UI用の情報を作成して返却する
 * @param {number} total - 最終ページ数
 * @param {number} current - 現在表示中のページ数
 * @return {PagenationInfo} - ページネーション表示用の情報
 */
export function CreatePagenationInfo(total: number, current: number): PagenationInfo {
	const pages: Page[] = [];

	// 全体で10件のページを表示する
	// 最終ページまで5件を切っている場合は、最終ページ-9から、足りない場合は1から表示する
	// それ以外の場合、現在選択ページより5ページ前から表示する。現在ページが5ページより手前の場合は1から表示する。
	let firstPage = 1;
	if (total - current < 5) {
		firstPage = total - 9 > 1 ? total - 9 : 1;
	} else {
		firstPage = current - 5 > 1 ? current - 5 : 1;
	}
	const lastPage = firstPage + 9 <= total ? firstPage + 9 : total;

	for (let i = firstPage; i <= lastPage; i++) {
		pages.push({
			page: i,
			current: i === current,
		});
	}

	return {
		pages,
		isFirstPage: current === 1,
		isLastPage: current === total,
		previousPage: current - 1,
		nextPage: current + 1,
	};
}

export function BaseURL(query: { [key: string]: string }): string {
	let result = "?";
	const keys = Object.keys(query);
	for (let i = 0; i < keys.length; i++) {
		if (keys[i] !== "page") {
			result += keys[i] + "=" + query[keys[i]] + "&";
		}
	}
	return result;
}

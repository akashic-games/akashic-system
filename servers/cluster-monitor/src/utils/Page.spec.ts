import { CreatePagenationInfo } from "./Page";

describe("CreatePagenationInfo", () => {
	describe("isFirstPage/isLastPage/previousPage/nextPage", () => {
		it("1ページ目がカレントの場合、isFirstPageがtrueになる", () => {
			const pagenationInfo = CreatePagenationInfo(3, 1);
			expect(pagenationInfo.isFirstPage).toEqual(true);
		});

		it("1ページ目以外がカレントの場合、isFirstPageがfalseになる", () => {
			const pagenationInfo = CreatePagenationInfo(3, 2);
			expect(pagenationInfo.isFirstPage).toEqual(false);
		});

		it("最終ページがカレントの場合、isLastPageがtrueになる", () => {
			const pagenationInfo = CreatePagenationInfo(3, 3);
			expect(pagenationInfo.isLastPage).toEqual(true);
		});

		it("最終ページ以外がカレントの場合、isLastPageがfalseになる", () => {
			const pagenationInfo = CreatePagenationInfo(3, 2);
			expect(pagenationInfo.isLastPage).toEqual(false);
		});

		it("previousPageにはカレントの1つ前の数値、nextPageにはカレントの1つ後ろの数値が入る", () => {
			const pagenationInfo = CreatePagenationInfo(3, 2);
			expect(pagenationInfo.previousPage).toEqual(1);
			expect(pagenationInfo.nextPage).toEqual(3);
		});
	});

	describe("pages", function () {
		describe("最終ページまでの残りが5ページを切っている場合", () => {
			it("全体で10ページ以上あり、最終ページから10ページ分が出力される", () => {
				const pagenationInfo = CreatePagenationInfo(20, 18);
				expect(pagenationInfo.pages).toEqual([
					{ page: 11, current: false },
					{ page: 12, current: false },
					{ page: 13, current: false },
					{ page: 14, current: false },
					{ page: 15, current: false },
					{ page: 16, current: false },
					{ page: 17, current: false },
					{ page: 18, current: true },
					{ page: 19, current: false },
					{ page: 20, current: false },
				]);
			});

			it("全体で10ページ未満あり、１から最終ページまで出力される", () => {
				const pagenationInfo = CreatePagenationInfo(7, 6);
				expect(pagenationInfo.pages).toEqual([
					{ page: 1, current: false },
					{ page: 2, current: false },
					{ page: 3, current: false },
					{ page: 4, current: false },
					{ page: 5, current: false },
					{ page: 6, current: true },
					{ page: 7, current: false },
				]);
			});
		});

		describe("最終ページまでの残りが5ページ以上ある場合", () => {
			it("全体で10ページ以上あり、カレントが6ページ以降である場合、カレントから5ページ前から10ページ分出力される", () => {
				const pagenationInfo = CreatePagenationInfo(20, 7);
				expect(pagenationInfo.pages).toEqual([
					{ page: 2, current: false },
					{ page: 3, current: false },
					{ page: 4, current: false },
					{ page: 5, current: false },
					{ page: 6, current: false },
					{ page: 7, current: true },
					{ page: 8, current: false },
					{ page: 9, current: false },
					{ page: 10, current: false },
					{ page: 11, current: false },
				]);
			});

			it("全体で10ページ以上あり、カレントが6ページ未満である場合、１ページ目から10ページ分出力される", () => {
				const pagenationInfo = CreatePagenationInfo(20, 3);
				expect(pagenationInfo.pages).toEqual([
					{ page: 1, current: false },
					{ page: 2, current: false },
					{ page: 3, current: true },
					{ page: 4, current: false },
					{ page: 5, current: false },
					{ page: 6, current: false },
					{ page: 7, current: false },
					{ page: 8, current: false },
					{ page: 9, current: false },
					{ page: 10, current: false },
				]);
			});

			it("全体が10ページ未満であり、カレントが6ページ未満である場合、１ページ目から最終ページまで出力される", () => {
				const pagenationInfo = CreatePagenationInfo(8, 2);
				expect(pagenationInfo.pages).toEqual([
					{ page: 1, current: false },
					{ page: 2, current: true },
					{ page: 3, current: false },
					{ page: 4, current: false },
					{ page: 5, current: false },
					{ page: 6, current: false },
					{ page: 7, current: false },
					{ page: 8, current: false },
				]);
			});
		});
	});
});

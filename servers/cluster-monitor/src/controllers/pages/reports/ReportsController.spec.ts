import { limit } from "../../../share/constants";
import { createSearchParameter } from "./ReportsController";

describe("createSearchParameter", () => {
	it("queryが空の場合、デフォルトの設定が作成される", () => {
		expect(createSearchParameter({}, 1)).toEqual({
			condition: JSON.stringify({ report_type: "crash" }),
			sort: "-ts",
			_offset: 0,
			_limit: limit,
			_count: 1,
		});
	});

	it("pageが増えた場合、_offsetの設定が変更されて作成される", () => {
		expect(createSearchParameter({}, 3)).toEqual({
			condition: JSON.stringify({ report_type: "crash" }),
			sort: "-ts",
			_offset: limit * 2,
			_limit: limit,
			_count: 1,
		});
	});

	it("queryにsince、untilが含まれる場合、オブジェクトに設定が追加されて作成される", () => {
		expect(createSearchParameter({ since: "2017-04-19T13:57:09+0900", until: "2017-04-19T13:57:27+0900" }, 1)).toEqual({
			condition: JSON.stringify({ report_type: "crash" }),
			sort: "-ts",
			_offset: 0,
			_limit: limit,
			_count: 1,
			since: "2017-04-19T13:57:09+0900",
			until: "2017-04-19T13:57:27+0900",
		});
	});

	it("queryにsince、untilが以外のパラメータが含まれる場合、condition内に設定が追加されて作成される", () => {
		const query = {
			file: "test.cpp",
			instanceId: "4",
			message: "*boost::filesystem*",
			tag: "akashic.tag.test",
			level: "INFO",
			logger: "out",
		};

		expect(createSearchParameter(query, 1)).toEqual({
			condition: JSON.stringify({
				report_type: "crash",
				file: "test.cpp",
				instanceId: "4",
				message: "*boost\\:\\:filesystem*",
				tag: "akashic.tag.test",
				level: "INFO",
				logger: "out",
			}),
			sort: "-ts",
			_offset: 0,
			_limit: limit,
			_count: 1,
		});
	});
});

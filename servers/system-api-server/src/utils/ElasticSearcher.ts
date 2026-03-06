import moment from "moment";
import request from "superagent";
import * as url from "url";
import { ElasticSearchConfig } from "./ElasticSearchConfig";

export interface ElasticSearcherRequest {
	from?: number;
	size?: number;
	sort?: any;
	conditions?: { [key: string]: string };
	range?: { since?: Date; until?: Date };
}

export interface ElasticSearcherResponse {
	total: number;
	hits?: { _source: any }[];
}

export class ElasticSearcher {
	public _config: ElasticSearchConfig;
	public _getUrl: string;

	constructor(config: ElasticSearchConfig) {
		this._config = config;
		this._getUrl = url.resolve(
			this._config.baseUrl,
			"/" + this._config.index + "/" + this._config.type + "/_search?" + this._config.searchQuery,
		);
	}

	public findReports(req: ElasticSearcherRequest): Promise<ElasticSearcherResponse> {
		const r = request("GET", this._getUrl).accept("json");
		r.send(this._makeSearchRequestBody(req)).type("json");
		return new Promise((resolve, reject) => {
			r.end((err: any, res: request.Response) => {
				if (err) {
					reject(err);
				} else {
					if (!res.body || !res.body.hits || typeof res.body.hits.total !== "number") {
						return reject("illegal response:" + res.body);
					}
					resolve(res.body.hits);
				}
			});
		});
	}

	public _makeSearchRequestBody(req: ElasticSearcherRequest): any {
		const body: any = {
			from: req.from,
			size: req.size,
			sort: [
				// 現状は生成時刻の降順固定:
				{ "@timestamp": "desc" },
			],
			_source: {
				// 検索結果に不要なため除外:
				exclude: ["container_id"],
			},
		};

		let filters: any = [];
		if (req.conditions) {
			filters = Object.keys(req.conditions).map((key) => {
				// このコメントアウト部を使用すると、大文字・小文字を区別しない検索にできる。要lowercase
				// const r: any = {wildcard: {}};
				// r.wildcard[key] = req.conditions[key].toLowercase();

				// 現状*cpp*281*のように*の中が数値のみの検索と文字列を組み合わせた検索は失敗する（0件が返る）
				const r: any = { query_string: {} };
				r.query_string.query = `${key}: ${req.conditions[key]}`;
				return r;
			});
		}
		if (req.range) {
			const timestamp: any = {};
			if (req.range.since) {
				timestamp.gte = moment(req.range.since).format();
			}
			if (req.range.until) {
				timestamp.lte = moment(req.range.until).format();
			}
			filters.push({
				range: {
					"@timestamp": timestamp,
				},
			});
		}
		if (filters.length > 0) {
			body.query = {
				bool: {
					must: filters,
				},
			};
		}
		return body;
	}
}

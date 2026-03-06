/**
 * log4jsの置き換えに伴い作成した
 * https://github.com/log4js-node/log4js-node/blob/master/lib/connect-logger.js の @akashic-system/logger向けの移植実装
 */
import { Request, Response, NextFunction, Handler } from "express";
import { ILogger, LogLevel, Context } from "@akashic-system/logger";
import { OutgoingHttpHeader, OutgoingHttpHeaders } from "http";

type LoggerRequest = Request & { _logging?: boolean; _remoteAddress?: string };
type LoggerResponse = Response & { __statusCode: number; __headers: OutgoingHttpHeaders; responseTime: number };
type FormatType = string | ((req: Request, res: Response, pred: (str: string) => string) => string);
type NoLogType = string | RegExp | (string | { source: string })[];
type RuleSet = { from?: number; to?: number; codes?: number[]; level: LogLevel }[];
type Token = { token: string | RegExp; replacement: string | ((substring: string, ...args: any[]) => string) };
export type CreateLogMiddlewareOptions = {
	format?: FormatType;
	level?: LogLevel | "auto";
	noLog?: NoLogType;
	statusRules?: RuleSet;
	context?: Context;
	tokens?: Token[];
};

const DEFAULT_FORMAT =
	":remote-addr - -" + ' ":method :url HTTP/:http-version"' + ' :status :content-length ":referrer"' + ' ":user-agent"';

/**
 * Return request url path,
 * adding this function prevents the Cyclomatic Complexity,
 * for the assemble_tokens function at low, to pass the tests.
 *
 * @param  {IncomingMessage} req
 * @return {string}
 * @api private
 */
function getUrl(req: Request): string {
	return req.originalUrl || req.url;
}

/**
 * Adds custom {token, replacement} objects to defaults,
 * overwriting the defaults if any tokens clash
 *
 * @param  {IncomingMessage} req
 * @param  {ServerResponse} res
 * @param  {Array} customTokens
 *    [{ token: string-or-regexp, replacement: string-or-replace-function }]
 * @return {Array}
 */
function assembleTokens(req: LoggerRequest, res: LoggerResponse, customTokens: Token[]): Token[] {
	const arrayUniqueTokens = (array: Token[]): Token[] => {
		const a = array.concat();
		for (let i = 0; i < a.length; ++i) {
			for (let j = i + 1; j < a.length; ++j) {
				// not === because token can be regexp object
				// tslint:disable-next-line triple-equals
				if (a[i].token == a[j].token) {
					a.splice(j--, 1);
				}
			}
		}
		return a;
	};

	const defaultTokens: Token[] = [];
	defaultTokens.push({ token: ":url", replacement: getUrl(req) });
	defaultTokens.push({ token: ":protocol", replacement: req.protocol });
	defaultTokens.push({ token: ":hostname", replacement: req.hostname });
	defaultTokens.push({ token: ":method", replacement: req.method });
	defaultTokens.push({
		token: ":status",
		replacement: String(res.__statusCode || res.statusCode),
	});
	defaultTokens.push({
		token: ":response-time",
		replacement: String(res.responseTime),
	});
	defaultTokens.push({ token: ":date", replacement: new Date().toUTCString() });
	defaultTokens.push({
		token: ":referrer",
		replacement: String(req.headers.referer || req.headers.referrer || ""),
	});
	defaultTokens.push({
		token: ":http-version",
		replacement: `${req.httpVersionMajor}.${req.httpVersionMinor}`,
	});
	defaultTokens.push({
		token: ":remote-addr",
		replacement:
			req.headers["x-forwarded-for"] ||
			req.ip ||
			req._remoteAddress ||
			(req.socket && (req.socket.remoteAddress || ((req.socket as any).socket && (req.socket as any).socket.remoteAddress))),
	});
	defaultTokens.push({
		token: ":user-agent",
		replacement: req.headers["user-agent"] ?? "-",
	});
	defaultTokens.push({
		token: ":content-length",
		replacement: String(res.getHeader("content-length") || (res.__headers && res.__headers["Content-Length"]) || "-"),
	});
	defaultTokens.push({
		token: /:req\[([^\]]+)]/g,
		replacement(_, field) {
			const h = req.headers[field.toLowerCase()];
			if (typeof h === "string") {
				return h;
			} else if (Array.isArray(h)) {
				return h.join(" ");
			} else {
				return "-";
			}
		},
	});
	defaultTokens.push({
		token: /:res\[([^\]]+)]/g,
		replacement(_, field) {
			return String((res.getHeader(field.toLowerCase()) || (res.__headers && res.__headers[field])) ?? "-");
		},
	});

	return arrayUniqueTokens(customTokens.concat(defaultTokens));
}

/**
 * Return formatted log line.
 *
 * @param  {string} str
 * @param {Array} tokens
 * @return {string}
 * @api private
 */
function format(str: string, tokens: Token[]): string {
	for (const token of tokens) {
		str = str.replace(token.token, token.replacement as any);
	}
	return str;
}

/**
 * Return RegExp Object about noLog
 *
 * @param  {(string|Array)} noLog
 * @return {RegExp}
 * @api private
 *
 * syntax
 *  1. String
 *   1.1 "\\.gif"
 *         NOT LOGGING http://example.com/hoge.gif and http://example.com/hoge.gif?fuga
 *         LOGGING http://example.com/hoge.agif
 *   1.2 in "\\.gif|\\.jpg$"
 *         NOT LOGGING http://example.com/hoge.gif and
 *           http://example.com/hoge.gif?fuga and http://example.com/hoge.jpg?fuga
 *         LOGGING http://example.com/hoge.agif,
 *           http://example.com/hoge.ajpg and http://example.com/hoge.jpg?hoge
 *   1.3 in "\\.(gif|jpe?g|png)$"
 *         NOT LOGGING http://example.com/hoge.gif and http://example.com/hoge.jpeg
 *         LOGGING http://example.com/hoge.gif?uid=2 and http://example.com/hoge.jpg?pid=3
 *  2. RegExp
 *   2.1 in /\.(gif|jpe?g|png)$/
 *         SAME AS 1.3
 *  3. Array
 *   3.1 ["\\.jpg$", "\\.png", "\\.gif"]
 *         SAME AS "\\.jpg|\\.png|\\.gif"
 */
function createNoLogCondition(noLog: NoLogType | undefined): RegExp | null {
	let regexp: RegExp | null = null;

	if (noLog instanceof RegExp) {
		regexp = noLog;
	}

	if (typeof noLog === "string") {
		regexp = new RegExp(noLog);
	}

	if (Array.isArray(noLog)) {
		// convert to strings
		const regexpsAsStrings = noLog.map((reg) => (typeof reg === "string" ? reg : reg.source));
		regexp = new RegExp(regexpsAsStrings.join("|"));
	}

	return regexp;
}

/**
 * Allows users to define rules around status codes to assign them to a specific
 * logging level.
 * There are two types of rules:
 *   - RANGE: matches a code within a certain range
 *     E.g. { 'from': 200, 'to': 299, 'level': 'info' }
 *   - CONTAINS: matches a code to a set of expected codes
 *     E.g. { 'codes': [200, 203], 'level': 'debug' }
 * Note*: Rules are respected only in order of precedence.
 *
 * @param {Number} statusCode
 * @param {Level} currentLevel
 * @param {Object} ruleSet
 * @return {Level}
 * @api private
 */
function matchRules(statusCode: number, currentLevel: LogLevel, ruleSet: RuleSet | undefined): LogLevel {
	let level = currentLevel;

	if (ruleSet) {
		const matchedRule = ruleSet.find((rule) => {
			let ruleMatched = false;
			if (rule.from && rule.to) {
				ruleMatched = statusCode >= rule.from && statusCode <= rule.to;
			} else if (rule.codes) {
				ruleMatched = rule.codes.indexOf(statusCode) !== -1;
			}
			return ruleMatched;
		});
		if (matchedRule) {
			level = matchedRule.level ?? level;
		}
	}
	return level;
}

/**
 * Log requests with the given `options` or a `format` string.
 *
 * Options:
 *
 *   - `format`        Format string, see below for tokens
 *   - `level`         A log4js levels instance. Supports also 'auto'
 *   - `noLog`         A string or RegExp to exclude target logs
 *   - `statusRules`   A array of rules for setting specific logging levels base on status codes
 *   - `context`       Whether to add a response of express to the context
 *
 * Tokens:
 *
 *   - `:req[header]` ex: `:req[Accept]`
 *   - `:res[header]` ex: `:res[Content-Length]`
 *   - `:http-version`
 *   - `:response-time`
 *   - `:remote-addr`
 *   - `:date`
 *   - `:method`
 *   - `:url`
 *   - `:referrer`
 *   - `:user-agent`
 *   - `:status`
 *
 */
export function createLogMiddleware(logger: ILogger, opt: CreateLogMiddlewareOptions | FormatType): Handler {
	let options: CreateLogMiddlewareOptions;
	if (typeof opt === "string" || typeof opt === "function") {
		options = { format: opt };
	} else {
		options = opt || {};
	}

	let level = (options.level === "auto" ? LogLevel.INFO : options.level) ?? LogLevel.INFO;
	const fmt = options.format || DEFAULT_FORMAT;
	const noLog = createNoLogCondition(options.noLog);

	return ((req: LoggerRequest, res: LoggerResponse, next: NextFunction) => {
		// mount safety
		if (req._logging) return next();

		// noLogs
		if (noLog && noLog.test(req.originalUrl)) return next();

		// if (logger.isLevelEnabled(level) || options.level === "auto") { // 新loggerにはisLevelEnabled相当無いので全部通し
		const start = new Date();
		const { writeHead } = res;

		// flag as logging
		req._logging = true;

		// proxy for statusCode.
		res.writeHead = (
			code: number,
			headersOrReasonPhrase?: OutgoingHttpHeaders | OutgoingHttpHeader[] | string,
			headersOrUndef?: OutgoingHttpHeaders | OutgoingHttpHeader[],
		): LoggerResponse => {
			const headers = typeof headersOrReasonPhrase === "string" ? headersOrUndef : headersOrReasonPhrase;
			res.writeHead = writeHead;
			res.writeHead(code, headers);

			res.__statusCode = code;
			if (Array.isArray(headers)) {
				res.__headers = headers.reduce((acc, header) => {
					if (Array.isArray(header)) {
						acc[header[0]] = header[1];
					} else {
						acc[header] = header;
					}
					return acc;
				}, {} as OutgoingHttpHeaders);
			} else {
				res.__headers = headers || {};
			}
			return res;
		};

		// hook on end request to emit the log entry of the HTTP request.
		res.on("finish", () => {
			res.responseTime = new Date().getTime() - start.getTime();
			// status code response level handling
			if (res.statusCode && options.level === "auto") {
				level = LogLevel.INFO;
				if (res.statusCode >= 300) level = LogLevel.WARN;
				if (res.statusCode >= 400) level = LogLevel.ERROR;
			}
			level = matchRules(res.statusCode, level, options.statusRules);

			const combinedTokens = assembleTokens(req, res, options.tokens || []);

			if (typeof fmt === "function") {
				const line = fmt(req, res, (str) => format(str, combinedTokens));
				if (line) logger.writeLog(level, line, options.context ?? new Map());
			} else {
				logger.writeLog(level, format(fmt, combinedTokens), options.context ?? new Map());
			}
		});
		// }

		// ensure next gets always called
		return next();
	}) as Handler;
}

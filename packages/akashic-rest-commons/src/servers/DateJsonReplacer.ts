import dateFormat = require("dateformat");
import express = require("express");

export function setUp(app: express.Application) {
	// json中の文字列をローカルのtimezoneで出力するためにjson replacerを差し替える
	// 差し替え対象はexpressで使用するJSON.stringifyであり、通常の物は影響を受けない
	const beforeReplacer = app.get("json replacer");

	// 第1引数の `this:` は、 this の型宣言をするための TypeScript の専用の構文。
	// 生成される JavaScript のコードには、この this の引数の部分はなくなり、 `function (key, value)` になる。
	// see https://github.com/Microsoft/TypeScript/issues/3694
	app.set("json replacer", function (this: { [key: string]: any }, key: string, value: any) {
		// function記述方でthisをjsのthisにする
		// ここのthisはJSON変換しようとしているobjectのthis。this[key]にtoJSONする前のobjectが、valueにtoJSONしたあとのオブジェクトが入っている
		if (this[key] instanceof Date) {
			// Date.toJSONはUTCで出力されてしまうので、toJSONする前の物を使ってISO8601の+09:00で整形
			return dateFormat(this[key], "yyyy-mm-dd'T'HH:MM:sso");
		}
		// 別のjson replacerがいるならそれも呼ぶ
		if (typeof beforeReplacer === "function") {
			return beforeReplacer(key, value);
		}
		return value;
	});
}

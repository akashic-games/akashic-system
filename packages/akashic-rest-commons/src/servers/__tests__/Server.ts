import * as express from "express";
import * as http from "http";
import * as https from "https";
import { TestLogger } from "@akashic-system/logger";
import Server from "../Server";
import ServerSettings from "../ServerSettings";

describe("Server class", () => {
	describe("createServer method", () => {
		it("should return http.Server", () => {
			const settings = {
				listening: 3456,
				accessLogger: new TestLogger(),
				router: express.Router(),
			} as ServerSettings;
			const server = Server.createServer(settings);
			expect(server).not.toBeNull();
			expect(server.listening).toBe(false);
		});
	});

	describe("start method", () => {
		it("should return http.Server already start to listen", (done) => {
			// http.Server
			const settings = {
				listening: 3456,
				accessLogger: new TestLogger(),
				router: express.Router(),
			} as ServerSettings;
			const server = new Server().start(settings);
			expect(server.listening).toBe(true);

			server.close(() => {
				done();
			});
		});
		describe("if server settings contains key and certification", () => {
			it("should return https Server", (done) => {
				// ここで使用されている鍵と証明書は、このテストのためだけにつくったオレオレ証明書とその鍵で、
				//   どこかのページとかで使ったりはしていないので、セキュリティ的な問題はない。
				const settings = {
					listening: 3457,
					accessLogger: new TestLogger(),
					router: express.Router(),
					// ファイルで読み込むと、読み込みのテストを書かなきゃいけないので、ハードコーディングする
					key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA5518poOZPOwDNUYFyK2SVVkqkJcIzVVj9ylIt+4uCAqrKhx6
XvDeNX6YaIJyzCWe97kfz/qHSidGjNJZMDgPg9FE/qnvJ5Ms94I+1SnObX1nPfTH
KCowgUTnthsZ91LG3J9osV+AiH/mznZSiKxmpbKB9FuWH68kCe79ElBDVY4uiGXQ
KZojQSrbV2vtuPyTKQoJFl/GOKbbP1oejoTG39YEt1bSg/V5bIiRAsKIqaBLxHS4
bXo2rW17QZTfQbUT5KalAAVrgAJfBZVjvn0G4OohkiWV8QNDvWnQbTYbXs0pETe3
jMd4HfhKxpWYOOaC+WwvD6wFQ4PSgySmX5NnRwIDAQABAoIBAQC+vyeKJvULhD98
H0fiJnhOS9nPLGO2Xy2tvtVBjSlhvA+M5dkt2WbXXYP9BfmvAQizcUWuzd+fhUsH
7LBBEtpMMAuHQ8JOsFmnGR/QA9caut1M3Assm9pIi8vcYON4mTZnOe1JrqI3SEZ4
IGAGaR08Nw/pg4fWXjHq8GSBMZLSoG3B0nTDx9tXg5tfJPco78cIMmHV7Y78C2ip
rgb3tPNoewhvkiz7OPaf0z9x+rklRUEqsyWtTrsKEupeIeEOzYTncH552Wac+WPo
bnDI8Uf7fJ7+HXIRshUm+77FzwPsuUywFB4AQhXN3Vuq8vABaV/wQ268oq8Uinbz
ebcxl3hZAoGBAPUPIQxRxVh1Sz0EPL6L/YxWbeOv7mQbZGADCF9WyWFutxAbuV6l
ZKUsSU+aVrBSUaXj1XSilcpjoLh6BgsT3JepwhZd+T/UNv14LWz37XeKNme38Ljy
tg1b5adw4TcyXBw2N0lAW+otyV4eJdG2Qtm4Uerv+S9z76WieO/fn9fzAoGBAPH0
s82gg5vFeuO3xRf5EaOGmEj414k8xC2uOgTRw9Vt8OGdE+jC8mVJb2MncJjawYTy
O1g5RaVKvAUzq9dvMsC5vGg4vdX9XdIKdhtd7qGXXeWoANlzGGTTPgoBeph3HIHM
w4dm62P4rWzrdDSppkvx3MbCH9yaF8e1Etp6xzxdAoGBALo0DbNzqpTlQw8Q2isa
6cQppAP+mRAdtC4z/7eZlRjgbF7kAf0FhSzwMqA2sKn3UqzPKlEefNy0yNmDdnYS
WGoxBhXCv/IdCM+d8j47QIe1UFOM829ElMofyqdo4Of07wJMu8OAEJcmxTwrgicP
60nNgQkX4GqLGEvt4SC69ZS7AoGAWGrQrerjTTA8OSz1pE4LSROtYLU2plsDYaIS
Z6J0CvFzHi81kFB1HdhZEQXfmqwOHdQbJaFANyf5T3lTaZWkGVOGaxuZG7LL7y6N
fHC1/G0BDiR3sv7hQi8Ds8pYj5CvZSt7pGZSzKSaU3wzae846vXGdQeJdycEW6Fq
81X8qq0CgYEAymdI/H9dakHci4FGD8PHhr3zUz+k9U5NkGB0r8hHtOL0Jgd3znx4
mFVJ4NEVncfsBBEDcU/5xEh6N571l0sU61F3WlXRzNF15M3au2ghiG7WLgLFJdK2
0JHZcZlq4KllkAZPd63cehTp/+I7XMDuKNGFxoqkmm/rui+dpQVulMs=
-----END RSA PRIVATE KEY-----`,
					// ファイルで読み込むと、読み込みのテストを書かなきゃいけないので、ハードコーディングする
					cert: `-----BEGIN CERTIFICATE-----
MIIDADCCAegCCQDFED4szJl6yzANBgkqhkiG9w0BAQUFADBCMQswCQYDVQQGEwJY
WDEVMBMGA1UEBwwMRGVmYXVsdCBDaXR5MRwwGgYDVQQKDBNEZWZhdWx0IENvbXBh
bnkgTHRkMB4XDTE3MDQyNTA3MDAxMVoXDTI0MDcyNzA3MDAxMVowQjELMAkGA1UE
BhMCWFgxFTATBgNVBAcMDERlZmF1bHQgQ2l0eTEcMBoGA1UECgwTRGVmYXVsdCBD
b21wYW55IEx0ZDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOedfKaD
mTzsAzVGBcitklVZKpCXCM1VY/cpSLfuLggKqyocel7w3jV+mGiCcswlnve5H8/6
h0onRozSWTA4D4PRRP6p7yeTLPeCPtUpzm19Zz30xygqMIFE57YbGfdSxtyfaLFf
gIh/5s52UoisZqWygfRblh+vJAnu/RJQQ1WOLohl0CmaI0Eq21dr7bj8kykKCRZf
xjim2z9aHo6Ext/WBLdW0oP1eWyIkQLCiKmgS8R0uG16Nq1te0GU30G1E+SmpQAF
a4ACXwWVY759BuDqIZIllfEDQ71p0G02G17NKRE3t4zHeB34SsaVmDjmgvlsLw+s
BUOD0oMkpl+TZ0cCAwEAATANBgkqhkiG9w0BAQUFAAOCAQEApEntvmd9sE1C7tVk
PYsZTZcbSu9pO3+14CfJQaWr4uIg3D16RTygDmuUlSTpGKGMbixSQQM5dGXousBP
DQXlICbuFmKYZEB26s5nPPoA+qs4O1wvEsJTqnMTaI9s3JPO8eP2Hh5FhiAyMW++
n+6kbbqdEBNYGBBXQLnk/lv3+Cc139nokI+WiFkWAsstxqrK4F2pDzE5NmcKTt/S
OAqTca6RdlHmfrlUuddb00vwyGQxxYd8kgDV52I+tA1dUDIKRQdKBbTq4uUckR44
GE/0FF+yfZYzeWBuUP4k0upnyJCv9y+Hy6JsZ8VA8DHJtlgaSbM8S79T8Qo0+vzW
0bmo1Q==
-----END CERTIFICATE-----`,
				} as ServerSettings;
				const server = new Server().start(settings) as https.Server;
				// https.Server の場合は、必ず key と cert を持っている。
				expect(Object.keys(server)).toContain("key");
				expect(Object.keys(server)).toContain("cert");

				server.close(() => {
					done();
				});
			});
			describe("but each one or both are null", () => {
				// Jasmine の typings の バージョンが古くて、DoneFn の定義がない。
				// 手動で追加するのはつらいので、古いバージョンでの定義に合わせる。
				it("should return http Server , NOT over SSL/TLS", (done) => {
					// ここで使用されている鍵と証明書は、このテストのためだけにつくったオレオレ証明書とその鍵で、
					//   どこかのページとかで使ったりはしていないので、セキュリティ的な問題はない。
					const settings = {
						listening: 3459,
						accessLogger: new TestLogger(),
						router: express.Router(),
						// ファイルで読み込むと、読み込みのテストを書かなきゃいけないので、ハードコーディングする
						key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA5518poOZPOwDNUYFyK2SVVkqkJcIzVVj9ylIt+4uCAqrKhx6
XvDeNX6YaIJyzCWe97kfz/qHSidGjNJZMDgPg9FE/qnvJ5Ms94I+1SnObX1nPfTH
KCowgUTnthsZ91LG3J9osV+AiH/mznZSiKxmpbKB9FuWH68kCe79ElBDVY4uiGXQ
KZojQSrbV2vtuPyTKQoJFl/GOKbbP1oejoTG39YEt1bSg/V5bIiRAsKIqaBLxHS4
bXo2rW17QZTfQbUT5KalAAVrgAJfBZVjvn0G4OohkiWV8QNDvWnQbTYbXs0pETe3
jMd4HfhKxpWYOOaC+WwvD6wFQ4PSgySmX5NnRwIDAQABAoIBAQC+vyeKJvULhD98
H0fiJnhOS9nPLGO2Xy2tvtVBjSlhvA+M5dkt2WbXXYP9BfmvAQizcUWuzd+fhUsH
7LBBEtpMMAuHQ8JOsFmnGR/QA9caut1M3Assm9pIi8vcYON4mTZnOe1JrqI3SEZ4
IGAGaR08Nw/pg4fWXjHq8GSBMZLSoG3B0nTDx9tXg5tfJPco78cIMmHV7Y78C2ip
rgb3tPNoewhvkiz7OPaf0z9x+rklRUEqsyWtTrsKEupeIeEOzYTncH552Wac+WPo
bnDI8Uf7fJ7+HXIRshUm+77FzwPsuUywFB4AQhXN3Vuq8vABaV/wQ268oq8Uinbz
ebcxl3hZAoGBAPUPIQxRxVh1Sz0EPL6L/YxWbeOv7mQbZGADCF9WyWFutxAbuV6l
ZKUsSU+aVrBSUaXj1XSilcpjoLh6BgsT3JepwhZd+T/UNv14LWz37XeKNme38Ljy
tg1b5adw4TcyXBw2N0lAW+otyV4eJdG2Qtm4Uerv+S9z76WieO/fn9fzAoGBAPH0
s82gg5vFeuO3xRf5EaOGmEj414k8xC2uOgTRw9Vt8OGdE+jC8mVJb2MncJjawYTy
O1g5RaVKvAUzq9dvMsC5vGg4vdX9XdIKdhtd7qGXXeWoANlzGGTTPgoBeph3HIHM
w4dm62P4rWzrdDSppkvx3MbCH9yaF8e1Etp6xzxdAoGBALo0DbNzqpTlQw8Q2isa
6cQppAP+mRAdtC4z/7eZlRjgbF7kAf0FhSzwMqA2sKn3UqzPKlEefNy0yNmDdnYS
WGoxBhXCv/IdCM+d8j47QIe1UFOM829ElMofyqdo4Of07wJMu8OAEJcmxTwrgicP
60nNgQkX4GqLGEvt4SC69ZS7AoGAWGrQrerjTTA8OSz1pE4LSROtYLU2plsDYaIS
Z6J0CvFzHi81kFB1HdhZEQXfmqwOHdQbJaFANyf5T3lTaZWkGVOGaxuZG7LL7y6N
fHC1/G0BDiR3sv7hQi8Ds8pYj5CvZSt7pGZSzKSaU3wzae846vXGdQeJdycEW6Fq
81X8qq0CgYEAymdI/H9dakHci4FGD8PHhr3zUz+k9U5NkGB0r8hHtOL0Jgd3znx4
mFVJ4NEVncfsBBEDcU/5xEh6N571l0sU61F3WlXRzNF15M3au2ghiG7WLgLFJdK2
0JHZcZlq4KllkAZPd63cehTp/+I7XMDuKNGFxoqkmm/rui+dpQVulMs=
-----END RSA PRIVATE KEY-----`,
						cert: undefined,
					} as ServerSettings;
					const server = new Server().start(settings) as http.Server;
					// http.Server なので、" おそらく" 持っていない
					// http.Server がもって い な い かどうかは、未定義
					expect(Object.keys(server)).not.toContain("key");
					expect(Object.keys(server)).not.toContain("cert");

					server.close(() => {
						done();
					});
				});
			});
		});
		describe("two or more times called", () => {
			it("should throw Error when called two times or more", (done) => {
				const settings = {
					listening: 3458,
					accessLogger: new TestLogger(),
					router: express.Router(),
				} as ServerSettings;
				// NOT http.Server
				const server = new Server();
				// 1st time
				expect(() => {
					server.start(settings);
				}).not.toThrowError();
				// 2nd times
				expect(() => {
					server.start(settings);
				}).toThrowError();

				server.app?.close(() => {
					done();
				});
			});
		});
	});
});

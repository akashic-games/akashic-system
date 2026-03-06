import * as restCommons from "@akashic/akashic-rest-commons";
import * as restClientCore from "@akashic/rest-client-core";

/**
 * restAPIの4xx/5xx系エラーをそのまま再解釈してrestCommonsのエラーにして投げ返す
 */
export function restClientErrorToApiError<T>(error: any): Promise<T> {
	if (!isHttpError(error)) {
		return Promise.reject(error);
	}
	const err: restClientCore.Errors.RestClientError = error;
	const parsedError = new restCommons.Errors.ApiError(
		err.body.meta.message,
		err.body.meta.errorCode,
		err.body.meta.status,
		err.body.meta.debug,
	);
	return Promise.reject(parsedError);
}

export function isHttpError(error: any): boolean {
	if (!(error instanceof restClientCore.Errors.RestClientError)) {
		return false;
	}
	const err: restClientCore.Errors.RestClientError = error;

	if (err.type !== restClientCore.Errors.ErrorType.HTTPError || !err.body) {
		return false;
	}
	return true;
}

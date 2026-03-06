import { Errors as restCommonsErrors } from "@akashic/akashic-rest-commons";
import { Errors as restClientErrors } from "@akashic/rest-client-core";
/**
 * restAPIの4xx/5xx系エラーをそのまま再解釈してrestCommonsのエラーにして投げ返す
 */
export function restClientErrorToApiError<T>(error: any): Promise<T> {
	if (!isHttpError(error)) {
		return Promise.reject(error);
	}
	const err: restClientErrors.RestClientError = error;
	const parsedError = new restCommonsErrors.ApiError(
		err.body.meta.message,
		err.body.meta.errorCode,
		err.body.meta.status,
		err.body.meta.debug,
	);
	return Promise.reject(parsedError);
}

export function isHttpError(error: any) {
	if (!error.type || !error.body) {
		return false;
	}
	const err: restClientErrors.RestClientError = error;
	if (err.type !== restClientErrors.ErrorType.HTTPError || !err.body) {
		return false;
	}
	return true;
}

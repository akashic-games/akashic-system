import * as amflow from "@akashic/amflow";

export function createError(name: string, msg: string, cause?: any): amflow.AMFlowError {
	const err = new Error(msg) as amflow.AMFlowError;
	err.name = name;
	if (cause) {
		err.cause = cause;
	}
	return err;
}

export function createPermissionError(msg: string, cause?: any): amflow.AMFlowError {
	return createError("PermissionError", msg, cause);
}

export function createRuntimeError(msg: string, cause?: any): amflow.AMFlowError {
	return createError("RuntimeError", msg, cause);
}

export function createInvalidStateError(msg: string, cause?: any): amflow.AMFlowError {
	return createError("InvalidState", msg, cause);
}

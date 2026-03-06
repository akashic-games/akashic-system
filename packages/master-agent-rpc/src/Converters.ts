import * as dt from "@akashic/server-engine-data-types";
import * as Types from "./thrift/cluster_types";
import * as RpcDataTypes from "./dataTypes";

export function clusterIdentityToRPC(identity: dt.ClusterIdentityLike): Types.ClusterIdentity {
	return new Types.ClusterIdentity({
		fqdn: identity.fqdn.value,
		type: identity.type,
		name: identity.name,
		czxid: identity.czxid,
	});
}

export function clusterIdentityFromRPC(identity: Types.ClusterIdentity): dt.ClusterIdentity {
	return new dt.ClusterIdentity({
		fqdn: new dt.Fqdn(identity.fqdn),
		type: identity.type,
		name: identity.name,
		czxid: identity.czxid,
	});
}

export function processInfoToRPC(processInfo: RpcDataTypes.ProcessInfo): Types.ProcessInfo {
	return new Types.ProcessInfo({
		clusterIdentity: clusterIdentityToRPC(processInfo.clusterIdentity),
		port: processInfo.port,
		machineValues: JSON.stringify(processInfo.machineValues),
	});
}

export function processInfoFromRPC(processInfo: Types.ProcessInfo): RpcDataTypes.ProcessInfo {
	let machineValues: any = {};
	try {
		machineValues = JSON.parse(processInfo.machineValues);
	} catch (e) {
		throw new Types.RPCError({
			errorCode: Types.ErrorCode.PARAMETER_ERROR,
			message: "failed to parse machineValues. " + e.message,
		});
	}
	return {
		clusterIdentity: clusterIdentityFromRPC(processInfo.clusterIdentity),
		port: processInfo.port,
		machineValues,
	};
}

export function processStatusInfoToRPC(processStatusInfo: dt.ProcessStatusInfo): Types.ProcessStatusInfo {
	return new Types.ProcessStatusInfo({
		instanceId: processStatusInfo.instanceId,
		type: <Types.ProcessStatusType>(<number>processStatusInfo.type),
		message: processStatusInfo.message,
	});
}

export function processStatusInfoFromRPC(processStatusInfo: Types.ProcessStatusInfo): dt.ProcessStatusInfo {
	return new dt.ProcessStatusInfo({
		instanceId: processStatusInfo.instanceId,
		type: <dt.Constants.ProcessStatusType>(<number>processStatusInfo.type),
		message: processStatusInfo.message,
	});
}

export function moduleToRPC(m: dt.InstanceModuleLike): Types.Module {
	return new Types.Module({
		code: m.code,
		values: JSON.stringify(m.values),
	});
}

export function moduleFromRPC(m: Types.Module): dt.InstanceModuleLike {
	let values: any = {};
	try {
		values = JSON.parse(m.values);
	} catch (e) {
		throw new Types.RPCError({
			errorCode: Types.ErrorCode.PARAMETER_ERROR,
			message: "failed to parse module.values. " + e.message,
		});
	}
	return {
		code: m.code,
		values,
	};
}

export function instanceAssignmentToRPC(instanceAssignment: RpcDataTypes.InstanceAssignment): Types.InstanceAssignment {
	return new Types.InstanceAssignment({
		instanceId: instanceAssignment.instanceId,
		gameCode: instanceAssignment.gameCode,
		entryPoint: instanceAssignment.entryPoint,
		modules: instanceAssignment.modules.map((m) => moduleToRPC(m)),
		cost: instanceAssignment.cost,
		playId: instanceAssignment.playId,
		parentPlayIds: instanceAssignment.parentPlayIds,
	});
}

export function instanceAssignmentFromRPC(instanceAssignment: Types.InstanceAssignment): RpcDataTypes.InstanceAssignment {
	return {
		instanceId: instanceAssignment.instanceId,
		gameCode: instanceAssignment.gameCode,
		entryPoint: instanceAssignment.entryPoint,
		modules: instanceAssignment.modules.map((m) => moduleFromRPC(m)),
		cost: instanceAssignment.cost,
		playId: instanceAssignment.playId,
		parentPlayIds: instanceAssignment.parentPlayIds,
	};
}

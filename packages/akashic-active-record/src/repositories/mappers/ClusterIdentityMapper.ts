import * as dt from "@akashic/server-engine-data-types";

export function entityToRecord(identity: dt.ClusterIdentity): { reverseFqdn: string; type: string; name: string; czxid: string } {
	return {
		reverseFqdn: identity.fqdn.toReverseFQDN(),
		type: identity.type,
		name: identity.name,
		czxid: identity.czxid,
	};
}
export function recordToEntity(record: { reverseFqdn: string; type: string; name: string; czxid: string }): dt.ClusterIdentity {
	return new dt.ClusterIdentity({
		fqdn: dt.Fqdn.fromReverseFqdn(record.reverseFqdn),
		type: record.type,
		name: record.name,
		czxid: record.czxid,
	});
}

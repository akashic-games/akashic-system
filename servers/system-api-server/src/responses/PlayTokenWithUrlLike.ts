import * as dt from "@akashic/server-engine-data-types";

export interface PlayTokenWithUrlLike {
	id: string;
	playId: string;
	value: string;
	expire: Date;
	url?: string;
	permission: any;
	meta: dt.PlayTokenMetaLike;
}

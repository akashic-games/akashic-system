import dt = require("@akashic/server-engine-data-types");

export class TokenGenerateService {
	private _securityConfig: dt.SecurityConfig;
	private _availableTimeMS = 1000 * 60 * 60 * 4; // 4時間

	constructor(securityConfig: dt.SecurityConfig) {
		this._securityConfig = securityConfig;
	}

	public generate(
		playId: string,
		userId: string,
		permission: dt.PlayTokenPermissionLike,
		ttlsec?: number,
		meta?: dt.PlayTokenMetaLike,
	): dt.PlayToken {
		const expire = new Date(new Date().getTime() + (ttlsec ? ttlsec * 1000 : this._availableTimeMS));

		if (meta && !meta.userId && userId) {
			meta.userId = userId;
		} else if (!meta && userId) {
			meta = { userId };
		}

		return dt.PlayToken.generatePlayToken(playId, this._securityConfig.permissionSecret, expire, permission, meta);
	}
}

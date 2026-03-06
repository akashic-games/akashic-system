import { Method, NicoApiResponse } from "@akashic/rest-client-core";
import { BaseApiClient } from "./BaseApiClient";
import * as dt from "./DataTypes";
import methods from "./methods";

export class SystemApiClient extends BaseApiClient {
	private _findPlaysMethod: Method<dt.PagingResponse<dt.Play>>;
	private _getPlayMethod: Method<dt.Play>;
	private _createPlayMethod: Method<dt.Play>;
	private _deletePlayMethod: Method<dt.Play>;
	private _patchPlayMethod: Method<dt.Play>;
	private _createPlayTokenMethod: Method<dt.PlayToken>;
	private _deletePlayTokenMethod: Method<dt.EmptyResponse>;
	private _findPlayInstancesMethod: Method<dt.PagingResponse<dt.Instance>>;
	private _createPlaylogEventMethod: Method<dt.Play>;
	private _getPlaylogMethod: Method<string>;
	private _getInstanceMethod: Method<dt.Instance>;
	private _createInstanceMethod: Method<dt.Instance>;
	private _deleteInstanceMethod: Method<dt.EmptyResponse>;
	private _findInstanceMethod: Method<dt.PagingResponse<dt.Instance>>;
	private _findReportsMethod: Method<dt.PagingResponse<any>>;
	private _createPlayChildrenMethod: Method<dt.EmptyResponse>;
	private _deletePlayChildrenMethod: Method<dt.EmptyResponse>;

	constructor(baseUrl: string) {
		super(baseUrl);
		this._findPlaysMethod = this.createMethod(methods.findPlays);
		this._getPlayMethod = this.createMethod(methods.getPlay);
		this._createPlayMethod = this.createMethod(methods.createPlay);
		this._deletePlayMethod = this.createMethod(methods.deletePlay);
		this._createPlayTokenMethod = this.createMethod(methods.createPlayToken);
		this._deletePlayTokenMethod = this.createMethod(methods.deletePlayToken);
		this._patchPlayMethod = this.createMethod(methods.patchPlay);
		this._findPlayInstancesMethod = this.createMethod(methods.findPlayInstances);
		this._createPlaylogEventMethod = this.createMethod(methods.createPlaylogEvent);
		this._getPlaylogMethod = this.createMethod(methods.getPlaylog);
		this._getInstanceMethod = this.createMethod(methods.getInstance);
		this._createInstanceMethod = this.createMethod(methods.createInstance);
		this._deleteInstanceMethod = this.createMethod(methods.deleteInstance);
		this._findInstanceMethod = this.createMethod(methods.findInstance);
		this._findReportsMethod = this.createMethod(methods.findReports);
		this._createPlayChildrenMethod = this.createMethod(methods.createPlayChildren);
		this._deletePlayChildrenMethod = this.createMethod(methods.deletePlayChildren);
	}

	// ■■■ インスタンスAPI ■■■
	public findPlayInstances(playId: string): Promise<NicoApiResponse<dt.PagingResponse<dt.Instance>>> {
		return this._findPlayInstancesMethod.exec({ playId });
	}

	public getInstance(instanceId: string): Promise<NicoApiResponse<dt.Instance>> {
		return this._getInstanceMethod.exec({ instanceId });
	}

	public createInstance(
		gameCode: string,
		modules: dt.InstanceModule[],
		cost: number,
		entryPoint: string,
	): Promise<NicoApiResponse<dt.Instance>> {
		return this._createInstanceMethod.exec(undefined, {
			gameCode,
			modules,
			cost,
			entryPoint,
		});
	}

	public deleteInstance(instanceId: string): Promise<NicoApiResponse<dt.EmptyResponse>> {
		return this._deleteInstanceMethod.exec({ instanceId });
	}

	public findInstance(args: dt.FindInstanceRequest): Promise<NicoApiResponse<dt.PagingResponse<dt.Instance>>> {
		return this._findInstanceMethod.exec(args);
	}

	// ■■■ プレーAPI - /plays ■■■
	public findPlays(options?: dt.FindPlayRequest): Promise<NicoApiResponse<dt.PagingResponse<dt.Play>>> {
		return this._findPlaysMethod.exec(options);
	}

	public getPlay(playId: string): Promise<NicoApiResponse<dt.Play>> {
		return this._getPlayMethod.exec({ playId });
	}

	public createPlay(gameCode: string): Promise<NicoApiResponse<dt.Play>>;
	public createPlay(args: dt.CreatePlayRequest): Promise<NicoApiResponse<dt.Play>>;
	public createPlay(argsOrGameCode: string | dt.CreatePlayRequest): Promise<NicoApiResponse<dt.Play>> {
		let postBody: dt.CreatePlayRequest;
		if (typeof argsOrGameCode === "string" || argsOrGameCode instanceof String) {
			postBody = { gameCode: argsOrGameCode as string };
		} else {
			postBody = argsOrGameCode;
		}
		return this._createPlayMethod.exec(undefined, postBody);
	}

	public deletePlay(playId: string): Promise<NicoApiResponse<dt.Play>> {
		return this._deletePlayMethod.exec({ playId });
	}

	public patchPlay(playId: string, status: string): Promise<NicoApiResponse<dt.Play>> {
		return this._patchPlayMethod.exec({ playId }, { status });
	}

	public startPlay(playId: string): Promise<NicoApiResponse<dt.Play>> {
		return this.patchPlay(playId, "running");
	}

	public stopPlay(playId: string): Promise<NicoApiResponse<dt.Play>> {
		return this.deletePlay(playId);
	}

	// ■■■ プレートークンAPI - /plays/:id/tokens ■■■
	public createPlayToken(
		playId: string,
		userId: string,
		permission: string | dt.PlayTokenPermission,
		options?: { ttl?: number; trait?: string; reserveEndpoint?: boolean },
	): Promise<NicoApiResponse<dt.PlayToken>> {
		let ttl: number | undefined;
		let trait: string | undefined;
		let reserveEndpoint: boolean | undefined;
		if (options) {
			ttl = options.ttl;
			trait = options.trait;
			reserveEndpoint = options.reserveEndpoint;
		}
		return this._createPlayTokenMethod.exec({ playId }, { userId, permission, ttl, trait, reserveEndpoint });
	}

	public deletePlayToken(playId: string, value: string): Promise<NicoApiResponse<dt.EmptyResponse>> {
		return this._deletePlayTokenMethod.exec({ playId }, { value });
	}

	// ■■■ プレーログイベント通知API - /plays/:id/events ■■■
	public createPlaylogEvent(playId: string, body: dt.CreatePlaylogEventRequest): Promise<NicoApiResponse<dt.EmptyResponse>> {
		return this._createPlaylogEventMethod.exec({ playId }, body);
	}

	// ■■■ プレーログ取得API - /plays/:id/playlog ■■■
	public getPlaylog(playId: string): Promise<NicoApiResponse<string>> {
		return this._getPlaylogMethod.exec({ playId });
	}

	// ■■■ レポート取得API - /reports ■■■
	public findReports(options?: dt.FindReportsRequest): Promise<NicoApiResponse<any>> {
		return this._findReportsMethod.exec(options);
	}

	// ■■■ 権限共有プレー設定API - /plays/:playId/children ■■■
	public createPlayChildren(
		playId: string,
		childId: string,
		options?: { allow?: dt.PlayTokenPermissionPartial; deny?: dt.PlayTokenPermissionPartial },
	): Promise<NicoApiResponse<dt.EmptyResponse>> {
		let allow: dt.PlayTokenPermissionPartial | undefined;
		let deny: dt.PlayTokenPermissionPartial | undefined;
		if (options) {
			allow = options.allow;
			deny = options.deny;
		}
		return this._createPlayChildrenMethod.exec({ playId }, { childId, allow, deny });
	}

	// ■■■ 権限共有プレー削除API - /plays/:playId/children/:childId ■■■
	public deletePlayChildren(playId: string, childId: string): Promise<NicoApiResponse<dt.EmptyResponse>> {
		return this._deletePlayChildrenMethod.exec({ playId, childId });
	}
}

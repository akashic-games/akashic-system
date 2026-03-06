import { context } from "@akashic-system/logger";
import * as AkashicSystem from "@akashic/akashic-system";
import * as CastUtil from "@akashic/cast-util";
import * as RPC from "@akashic/master-agent-rpc";
import * as dt from "@akashic/server-engine-data-types";
import config from "config";
import { Cluster as RedisCluster, RedisCommander, default as Redis } from "ioredis";
import { LogFactory } from "../../../../util/LogFactory";
import { ProcessConnections } from "../../../connections/ProcessConnections";
import { InstanceAssignmentRepository } from "../../../repositories/InstanceAssignmentRepository";
import { SearchResult } from "../dataTypes/SearchResult";

export class Designator {
	private _instanceAssignmentRepository: InstanceAssignmentRepository;
	private _processConnections: ProcessConnections;
	private _logFactory: LogFactory;
	private _redisRepository: RedisCommander;
	private _playlogRelationModel: AkashicSystem.PlayRelationModel | null;

	constructor(instanceAssignmentRepository: InstanceAssignmentRepository, processConnections: ProcessConnections, logFactory: LogFactory) {
		this._processConnections = processConnections;
		this._instanceAssignmentRepository = instanceAssignmentRepository;
		this._logFactory = logFactory;
		this._redisRepository = null;
		this._redisRepository = config.has("redis.hosts") // is cluster?
			? new RedisCluster(config.get("redis.hosts"), config.get("redis.option"))
			: new Redis(config.get("redis.port"), config.get("redis.host"), config.get("redis.option"));
		this._playlogRelationModel = new AkashicSystem.PlayRelationModel(
			AkashicSystem.Database.fromConfig(config.get<AkashicSystem.IDatabaseConfig>("dbSettings.database")),
			new AkashicSystem.LegacyCacheStore(this._redisRepository),
		);
	}
	public assign(searchResult: SearchResult): Promise<boolean> {
		const target = searchResult.target;
		const message = searchResult.message;
		const log = this._logFactory.getLogger("out", {
			instanceId: message.instanceId,
			targetNode: target.targetIdentity.getKeyString(),
		});
		const instanceAssignment = new dt.InstanceAssignment({
			targetIdentity: target.targetIdentity,
			targetPort: target.targetPort,
			gameCode: message.gameCode,
			instanceId: message.instanceId,
			entryPoint: message.entryPoint,
			requirement: target.cost,
			modules: message.modules,
		});
		log.info("割り当てを試みます", context({ instanceAssignment: instanceAssignment.toJSON() }));
		return this.assignInstance(instanceAssignment).then((result) => {
			if (!result) {
				// エラーが起きたので割り当て解除する
				log.warn("instanceの割り当て解除を実施します");

				// ここでのunassignは異常系の後始末且つ、処理時間の短縮の観点からいったん非同期にて実行することとする
				this._processConnections
					.unassignInstance(target.targetIdentity, target.targetPort, message.instanceId)
					.then(() => {
						log.warn("instanceの割り当て解除に成功しました");
					})
					.catch((error: Error) => {
						log.warn("instanceの割り当て解除に失敗しました", context({ error }));
					});

				return false;
			}
			return Promise.resolve(true);
		});
	}

	/**
	 * インスタンスの割り当てを実施する
	 */
	private async assignInstance(assignment: dt.InstanceAssignmentLike): Promise<boolean> {
		const instanceAssignment = new dt.InstanceAssignment(assignment);
		const log = this._logFactory.getLogger("out", {
			instanceId: instanceAssignment.instanceId,
			gameCode: instanceAssignment.gameCode,
			key: instanceAssignment.targetIdentity.getKeyString(),
		});
		try {
			const assignmentRPC = await this.toInstanceAssignmentRPC(instanceAssignment);
			log.info("instanceの割り当てを実施します", context({ assignmentRPC: JSON.stringify(assignmentRPC) }));
			return this._processConnections
				.assignInstance(instanceAssignment.targetIdentity, instanceAssignment.targetPort, assignmentRPC)
				.then(() => this._instanceAssignmentRepository.save(instanceAssignment))
				.then(() => {
					log.info("instanceの割り当てが完了しました");
					return true;
				})
				.catch((error: Error) => {
					if (error.message && error.message.includes("timeout")) {
						log.warn("instanceの割り当てがタイムアウトしました", context({ error }));
					}
					log.info("instanceの割り当てに失敗しました", context({ error }));
					return false;
				});
		} catch (error) {
			log.info("instanceの割り当てに失敗しました", context({ error }));
			return false;
		}
	}

	private async toInstanceAssignmentRPC(instanceAssignment: dt.InstanceAssignment): Promise<RPC.dataTypes.InstanceAssignment> {
		const log = this._logFactory.getLogger("out", {
			instanceId: instanceAssignment.instanceId,
			gameCode: instanceAssignment.gameCode,
			key: instanceAssignment.targetIdentity.getKeyString(),
		});
		let instanceAssignmentPlayId: string = "";
		for (const mod of instanceAssignment.modules) {
			if (mod.code === "staticPlaylogWorker" && mod.values.playlog) {
				try {
					instanceAssignmentPlayId = CastUtil.bigint(mod.values.playlog.playId, true);
				} catch (error) {
					// 不正なplayIdが指定された場合は、上位のAPIで4xxになるはずだが、ログを出して例外をスロー
					log.warn("staticPlaylogWorkerのplayIdが不正です", context({ error }));
					throw error;
				}
				break;
			} else if (mod.code === "dynamicPlaylogWorker") {
				try {
					instanceAssignmentPlayId = CastUtil.bigint(mod.values.playId, true);
				} catch (error) {
					// 不正なplayIdが指定された場合は、上位のAPIで4xxになるはずだが、ログを出して例外をスロー
					log.warn("dynamicPlaylogWorkerのplayIdが不正です", context({ error }));
					throw error;
				}
				break;
			} else {
				continue;
			}
		}

		return {
			instanceId: instanceAssignment.instanceId,
			gameCode: instanceAssignment.gameCode,
			entryPoint: instanceAssignment.entryPoint,
			modules: instanceAssignment.modules,
			cost: instanceAssignment.requirement,
			playId: instanceAssignmentPlayId,
			parentPlayIds: await this._playlogRelationModel.findParentPlayIdsByChild(instanceAssignmentPlayId),
		};
	}
}

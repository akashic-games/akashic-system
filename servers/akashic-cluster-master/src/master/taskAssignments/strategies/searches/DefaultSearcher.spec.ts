import { ClusterIdentity, Fqdn, InstanceAssignment, Process, ProcessIdentity } from "@akashic/server-engine-data-types";
import { LogFactory } from "../../../../util/LogFactory";
import { InstanceAssignmentRepository } from "../../../repositories/InstanceAssignmentRepository";
import { ProcessRepository } from "../../../repositories/ProcessRepository";
import { EvaluateResult } from "../dataTypes/EvaluateResult";
import { Requirement } from "../dataTypes/Requirement";
import { DefaultSearcher } from "./DefaultSearcher";

describe("DefaultSearcher", () => {
	const logFactory = new LogFactory();
	let processRepository: ProcessRepository;
	let instanceAssignmentRepository: InstanceAssignmentRepository;

	const database = {
		repositories: {
			process: {
				getAll: () => {
					return Promise.resolve([] as Process[]);
				},
			},
			excludedProcess: {
				getAll: () => {
					return Promise.resolve([] as ProcessIdentity[]);
				},
			},
			instanceAssignment: {
				getByIdentity: (_identity: ClusterIdentity) => {
					return Promise.resolve([] as InstanceAssignment[]);
				},
			},
		},
	};

	function createSearchCondition(cost: number, video: boolean, trait?: string[]): EvaluateResult {
		return new EvaluateResult(
			{
				instanceId: "1",
				gameCode: "test",
				entryPoint: "test",
				cost,
				modules: [],
				assignmentConstraints: { trait: trait ?? [] },
			},
			new Requirement("gameRunner2", cost, video, trait),
		);
	}

	function createProcess(name: string, capacity: number, video: boolean, trait?: string[]): Process {
		return new Process({
			clusterIdentity: {
				type: "gameRunner2",
				name,
				fqdn: new Fqdn("localhost"),
				czxid: "0",
			},
			port: 42,
			machineValues: {
				capacity,
				videoEnabled: video,
				trait,
			},
		});
	}

	function createExcludedProcess(name: string): ProcessIdentity {
		return new ProcessIdentity({
			type: "gameRunner2",
			name,
			fqdn: new Fqdn("localhost"),
		});
	}

	function createAssignment(name: string, requirement: number): InstanceAssignment {
		return new InstanceAssignment({
			targetIdentity: {
				type: "gameRunner2",
				name,
				fqdn: new Fqdn("localhost"),
				czxid: "0",
			},
			targetPort: 42,
			instanceId: "1",
			gameCode: "test",
			entryPoint: "test",
			requirement,
			modules: [],
		});
	}

	beforeEach(() => {
		processRepository = new ProcessRepository(database as any);
		instanceAssignmentRepository = new InstanceAssignmentRepository(database as any);
	});

	it("空のデータから検索できる", async () => {
		const searcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);
		const condition = createSearchCondition(1, false);
		const result = await searcher.search(condition);

		expect(result.length).toEqual(0);
	});

	it("空きの大きいプロセスが優先する", async () => {
		jest
			.spyOn(database.repositories.process, "getAll")
			.mockResolvedValue([createProcess("0", 10, false), createProcess("1", 2, false), createProcess("2", 8, false)]);
		jest.spyOn(database.repositories.instanceAssignment, "getByIdentity").mockImplementation((identity: ClusterIdentity) => {
			// process0: cost 2 x 3 instances (4 remains)
			// process1: no assignments (2 remains)
			// process2: cost 3 x 1 instances (6 remains)
			switch (identity.name) {
				case "0":
					return Promise.resolve([
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
					]);
				case "2":
					return Promise.resolve([createAssignment(identity.name, 3)]);
				default:
					return Promise.resolve([]);
			}
		});
		const searcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);

		// cost 3 割り当ての検索
		const condition = createSearchCondition(3, false);
		const result = await searcher.search(condition);
		expect(result.length).toEqual(2); // process1 が対象外
		expect(result[0].target.targetIdentity.name).toEqual("2"); // 空きの多い process2 が優先
		expect(result[1].target.targetIdentity.name).toEqual("0"); // 次に process0
	});

	it("ビデオ有効/無効要求が結果に反映される", async () => {
		jest
			.spyOn(database.repositories.process, "getAll")
			.mockResolvedValue([
				createProcess("0", 10, false),
				createProcess("1", 2, false),
				createProcess("2", 8, false),
				createProcess("3", 10, true),
				createProcess("4", 2, true),
				createProcess("5", 8, true),
			]);
		jest.spyOn(database.repositories.instanceAssignment, "getByIdentity").mockImplementation((identity: ClusterIdentity) => {
			// process0: cost 2 x 3 instances (4 remains), video disabled
			// process1: no assignments (2 remains), video disabled
			// process2: cost 3 x 1 instances (6 remains), video disabled
			// process3: cost 2 x 3 instances (4 remains), video enabled
			// process4: no assignments (2 remains), video enabled
			// process5: cost 3 x 1 instances (6 remains), video enabled
			switch (identity.name) {
				case "0":
				case "3":
					return Promise.resolve([
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
					]);
				case "2":
				case "5":
					return Promise.resolve([createAssignment(identity.name, 3)]);
				default:
					return Promise.resolve([]);
			}
		});
		const searcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);

		// cost 3, video 要求なし検索
		const withoutVideoCondition = createSearchCondition(3, false);
		const withoutVideoResult = await searcher.search(withoutVideoCondition);
		expect(withoutVideoResult.length).toEqual(2); // process1, 3, 4, 5 が対象外
		expect(withoutVideoResult[0].target.targetIdentity.name).toEqual("2"); // 空きの多い process2 が優先
		expect(withoutVideoResult[1].target.targetIdentity.name).toEqual("0"); // 次に process0

		// cost 3, video 要求あり検索
		const withVideoCondition = createSearchCondition(3, true);
		const withVideoResult = await searcher.search(withVideoCondition);
		expect(withVideoResult.length).toEqual(2); // process0, 1, 2, 4 が対象外
		expect(withVideoResult[0].target.targetIdentity.name).toEqual("5"); // 空きの多い process5 が優先
		expect(withVideoResult[1].target.targetIdentity.name).toEqual("3"); // 次に process3
	});

	it("trait 要求が結果に反映される", async () => {
		jest
			.spyOn(database.repositories.process, "getAll")
			.mockResolvedValue([
				createProcess("0", 10, false),
				createProcess("1", 2, false),
				createProcess("2", 8, false),
				createProcess("3", 10, false, ["trait0"]),
				createProcess("4", 2, false, ["trait0"]),
				createProcess("5", 8, false, ["trait0"]),
				createProcess("6", 10, false, ["trait1"]),
				createProcess("7", 2, false, ["trait1"]),
				createProcess("8", 8, false, ["trait1"]),
				createProcess("9", 10, false, ["trait1", "trait2"]),
				createProcess("10", 2, false, ["trait1", "trait2"]),
				createProcess("11", 8, false, ["trait1", "trait2"]),
			]);
		jest.spyOn(database.repositories.instanceAssignment, "getByIdentity").mockImplementation((identity: ClusterIdentity) => {
			// process0: cost 2 x 3 instances (4 remains), no trait
			// process1: no assignments (2 remains), no trait
			// process2: cost 3 x 1 instances (5 remains), no trait
			// process3: cost 2 x 3 instances (4 remains), trait: ["trait0"]
			// process4: no assignments (2 remains), trait: ["trait0"]
			// process5: cost 3 x 1 instances (5 remains), trait: ["trait0"]
			// process6: cost 2 x 3 instances (4 remains), trait: ["trait1"]
			// process7: no assignments (2 remains), trait: ["trait1"]
			// process8: cost 3 x 1 instances (5 remains), trait: ["trait1"]
			// process9: cost 2 x 3 instances (4 remains), trait: ["trait1", "trait2"]
			// process10: no assignments (2 remains), trait: ["trait1", "trait2"]
			// process11: cost 3 x 1 instances (5 remains), trait: ["trait1", "trait2"]
			switch (identity.name) {
				case "0":
				case "3":
				case "6":
				case "9":
					return Promise.resolve([
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
					]);
				case "2":
				case "5":
				case "8":
				case "11":
					return Promise.resolve([createAssignment(identity.name, 3)]);
				default:
					return Promise.resolve([]);
			}
		});
		const searcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);

		// cost 3, trait なし検索
		const withoutTraitCondition = createSearchCondition(3, false);
		const withoutTraitResult = await searcher.search(withoutTraitCondition);
		expect(withoutTraitResult.length).toEqual(2); // process1, 3, 4, 5, 6, 7, 8, 9, 10, 11 が対象外
		expect(withoutTraitResult[0].target.targetIdentity.name).toEqual("2"); // 空きの多い process2 が優先
		expect(withoutTraitResult[1].target.targetIdentity.name).toEqual("0"); // 次に process0

		// cost 3, trait: ["trait0"] 検索
		const trait0Condition = createSearchCondition(3, false, ["trait0"]);
		const trait0Result = await searcher.search(trait0Condition);
		expect(trait0Result.length).toEqual(2); // process0, 1, 2, 4, 6, 7, 8, 9, 10, 11 が対象外
		expect(trait0Result[0].target.targetIdentity.name).toEqual("5"); // 空きの多い process5 が優先
		expect(trait0Result[1].target.targetIdentity.name).toEqual("3"); // 次に process3

		// cost 3, trait: ["trait1"] 検索
		const trait1Condition = createSearchCondition(3, false, ["trait1"]);
		const trait1Result = await searcher.search(trait1Condition);
		expect(trait1Result.length).toEqual(2); // process0, 1, 2, 3, 4, 5, 7, 9, 10, 11 が対象外
		expect(trait1Result[0].target.targetIdentity.name).toEqual("8"); // 空きの多い process8 が優先
		expect(trait1Result[1].target.targetIdentity.name).toEqual("6"); // 次に process6

		// cost 3, trait: ["no_such_trait"] 検索
		const noSuchTraitCondition = createSearchCondition(3, false, ["no_such_trait"]);
		const noSuchTraitResult = await searcher.search(noSuchTraitCondition);
		expect(noSuchTraitResult.length).toEqual(0); // 該当 trait のプロセスが存在しない

		// cost 3, trait: [] 検索
		const emptyTraitCondition = createSearchCondition(3, false, []);
		const emptyTraitResult = await searcher.search(emptyTraitCondition);
		expect(emptyTraitResult.length).toEqual(0); // 該当 trait のプロセスが存在しない

		// cost 3, trait: ["trait1", "trait2"] 検索
		const multiTraitCondition = createSearchCondition(3, false, ["trait1", "trait2"]);
		const multiTraitResult = await searcher.search(multiTraitCondition);
		expect(multiTraitResult.length).toEqual(2); // process0, 1, 2, 3, 4, 5, 6, 7, 8, 10 が対象外
		expect(multiTraitResult[0].target.targetIdentity.name).toEqual("11"); // 空きの多い process11 が優先
		expect(multiTraitResult[1].target.targetIdentity.name).toEqual("9"); // 次に process9

		// cost 3, trait: ["trait1", "trait2", "no_such_trait"] 検索
		const noSuchMultiTraitCondition = createSearchCondition(3, false, ["trait1", "trait2", "no_such_trait"]);
		const noSuchMultiTraitResult = await searcher.search(noSuchMultiTraitCondition);
		expect(noSuchMultiTraitResult.length).toEqual(0); // 該当 trait のプロセスが存在しない
	});

	it("割り当て対象から外されているプロセスは選ばれない", async () => {
		jest
			.spyOn(database.repositories.process, "getAll")
			.mockResolvedValue([
				createProcess("0", 10, false),
				createProcess("1", 2, false),
				createProcess("2", 8, false),
				createProcess("3", 10, false),
				createProcess("4", 2, false),
				createProcess("5", 8, false),
			]);
		jest
			.spyOn(database.repositories.excludedProcess, "getAll")
			.mockResolvedValue([createExcludedProcess("0"), createExcludedProcess("1"), createExcludedProcess("2")]);
		jest.spyOn(database.repositories.instanceAssignment, "getByIdentity").mockImplementation((identity: ClusterIdentity) => {
			// process0: cost 2 x 3 instances (4 remains), excluded
			// process1: no assignments (2 remains), excluded
			// process2: cost 3 x 1 instances (6 remains), excluded
			// process3: cost 2 x 3 instances (4 remains)
			// process4: no assignments (2 remains)
			// process5: cost 3 x 1 instances (6 remains)
			switch (identity.name) {
				case "0":
				case "3":
					return Promise.resolve([
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
						createAssignment(identity.name, 2),
					]);
				case "2":
				case "5":
					return Promise.resolve([createAssignment(identity.name, 3)]);
				default:
					return Promise.resolve([]);
			}
		});
		const searcher = new DefaultSearcher(processRepository, instanceAssignmentRepository, logFactory);

		// cost 3 割り当ての検索
		const condition = createSearchCondition(3, false);
		const result = await searcher.search(condition);
		expect(result.length).toEqual(2); // process0, 1, 2, 4 が対象外
		expect(result[0].target.targetIdentity.name).toEqual("5"); // 空きの多い process5 が優先
		expect(result[1].target.targetIdentity.name).toEqual("3"); // 次に process3
	});
});

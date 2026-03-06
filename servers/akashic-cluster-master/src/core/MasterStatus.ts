export enum MasterStatus {
	/**
	 * マスターではなく、昇格待もしていない
	 */
	notMaster,
	/**
	 * マスター再チェック中(zookeeperとの通信切断等。この時にmasterとして行動してはならない)
	 */
	reChecking,
	/**
	 * マスターである
	 */
	master,
	/**
	 * 昔はmasterだったが、その地位を失ってしまった。
	 * または、zookeeperとの接続が切れてしまった。
	 * どちらにしても、master/master候補はリセットして再起動しなければいけない。
	 */
	fatal,
	/**
	 * 昇格待のmaster候補
	 */
	subMaster,
}

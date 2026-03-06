import FQDN = require("./Fqdn");

/**
 * 各プロセスをクラスタ全体で、死んで復活しても識別するためのIdentity
 */
interface ClusterIdentityLike {
	/**
	 * プロセス種別(ConstantsのTYPE_*定数を使用する)
	 */
	type: string;
	/**
	 * プロセス名。同一マシンの同一種別のプロセスを区別するために与えられる/報告される値
	 */
	name: string;
	/**
	 * プロセスが存在するマシンのFQDN
	 */
	fqdn: FQDN;
	/**
	 * プロセスのzookeeper上のznodeのczxid
	 */
	czxid: string;
}
export = ClusterIdentityLike;

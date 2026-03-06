import { EvaluateResult } from "../dataTypes/EvaluateResult";
import { SearchResult } from "../dataTypes/SearchResult";

/**
 * 割り当て対象となるマシンを選ぶstrategy patternのインターフェイス
 */
export interface Searcher {
	/**
	 * 割り当て対象マシンを探す
	 * failsには割り当てができなかったのを入れる。searcherはそれを考慮して探索を実施する
	 */
	search(evaluateResult: EvaluateResult): Promise<SearchResult[]>;
}

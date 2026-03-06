"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var RedisUtil;
(function (RedisUtil) {
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * @see RedisUtil.toMemberWithScoreLike()
     */
    function toMemberWithScore(flatMemberAndScores) {
        return RedisUtil.toMemberWithScoreLike(flatMemberAndScores, (input) => input);
    }
    RedisUtil.toMemberWithScore = toMemberWithScore;
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * - in:  ["m1", "1", "m2", "2", "m3", "3"]
     * - out: [{member: "m1", score: 1}, {member: "m2", score: 2}, {member: "m3", score: 3}]
     * リストが奇数の場合、最後の score 要素は除外される。
     */
    function toMemberWithScoreLike(flatMemberAndScores, instantiate) {
        if (!flatMemberAndScores || 1 >= flatMemberAndScores.length) {
            return [];
        }
        const resultSize = flatMemberAndScores.length / 2 | 0;
        const results = new Array(resultSize);
        let i = 0;
        for (let out = 0; out < resultSize; ++out, i += 2) {
            results[out] = instantiate({ member: flatMemberAndScores[i], score: Number(flatMemberAndScores[i + 1]) });
        }
        return results;
    }
    RedisUtil.toMemberWithScoreLike = toMemberWithScoreLike;
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * - in:  ["m1", "1", "m2", "2", "m3", "3"]
     * - out: {members: ["m1", "m2", "m3"], scores: [1, 2, 3]}
     * リストが奇数の場合、最後の要素は除外される。
     */
    function toMemberWithScoreList(flatMemberAndScores) {
        if (!flatMemberAndScores || flatMemberAndScores.length <= 1) {
            return { members: [], scores: [] };
        }
        const resultSize = flatMemberAndScores.length / 2 | 0;
        const members = new Array(resultSize);
        const scores = new Array(resultSize);
        let i = 0;
        for (let out = 0; out < resultSize; ++out, i += 2) {
            members[out] = flatMemberAndScores[i];
            scores[out] = Number(flatMemberAndScores[i + 1]);
        }
        return { members, scores };
    }
    RedisUtil.toMemberWithScoreList = toMemberWithScoreList;
})(RedisUtil = exports.RedisUtil || (exports.RedisUtil = {}));

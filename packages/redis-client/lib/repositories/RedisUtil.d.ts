export interface MemberWithScore {
    member: string;
    score: number;
}
export interface MemberWithScoreList {
    members: string[];
    scores: number[];
}
export declare namespace RedisUtil {
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * @see RedisUtil.toMemberWithScoreLike()
     */
    function toMemberWithScore(flatMemberAndScores: string[]): MemberWithScore[];
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * - in:  ["m1", "1", "m2", "2", "m3", "3"]
     * - out: [{member: "m1", score: 1}, {member: "m2", score: 2}, {member: "m3", score: 3}]
     * リストが奇数の場合、最後の score 要素は除外される。
     */
    function toMemberWithScoreLike<T>(flatMemberAndScores: string[], instantiate: (input: {
        member: string;
        score: number;
    }) => T): T[];
    /**
     * WITHSCORE オプション使用時の MEMBER/SCORE リスト取得ヘルパ
     * - in:  ["m1", "1", "m2", "2", "m3", "3"]
     * - out: {members: ["m1", "m2", "m3"], scores: [1, 2, 3]}
     * リストが奇数の場合、最後の要素は除外される。
     */
    function toMemberWithScoreList(flatMemberAndScores: string[]): MemberWithScoreList;
}

export function userSessionParser(userSession: string): { prefix: string; userId: string; hash: string } {
	const matches = userSession.match(/^user_session_(\d+)_(.*)$/);
	if (matches === null) {
		throw new Error("user session parse error. '" + userSession + "' is invalid user session string.");
	}
	const [, userId, hash] = matches; // 一つ目は、userSession 文字列全体
	return { prefix: "user_session_", userId, hash };
}

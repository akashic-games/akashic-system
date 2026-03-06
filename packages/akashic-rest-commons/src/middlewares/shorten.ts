export function shorten(str: string, maxLength: number): string {
	if (str.length <= maxLength) {
		return str;
	}
	return (str.substring(0, maxLength - 3) + "...").substring(0, maxLength);
}

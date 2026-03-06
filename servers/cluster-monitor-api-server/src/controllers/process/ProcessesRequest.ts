interface ProcessesRequest {
	/**
	 * @query
	 * @int
	 * @min 0
	 */
	_offset?: number;
	/**
	 * @query
	 * @int
	 * @min 0
	 * @max 100
	 */
	_limit?: number;
	/**
	 * @query
	 * @int
	 */
	_count?: number;
	/**
	 * @query
	 * @string
	 */
	host?: string;
	/**
	 * @query
	 * @string
	 */
	type?: string;
}
export = ProcessesRequest;

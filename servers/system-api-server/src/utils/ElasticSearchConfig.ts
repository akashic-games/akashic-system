export interface ElasticSearchConfig {
	/**
	 * API endpoint
	 */
	baseUrl: string;
	/**
	 * Index
	 */
	index: string;
	/**
	 * Type
	 */
	type: string;
	/**
	 * Search Query
	 */
	searchQuery: string;
}

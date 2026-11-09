/**
 * Search Provider Interface & Search Evidence Types
 *
 * Designed to decouple search retrieval logic from AI orchestration.
 * Allows seamless replacement of search providers (e.g., Tavily, Brave, Google)
 * without altering the AI inference pipeline.
 */

export interface SearchEvidenceSource {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  score?: number;
}

export interface SearchQueryResult {
  query: string;
  sources: SearchEvidenceSource[];
  retrievedAt: string;
  provider: string;
  cached?: boolean;
}

export interface ISearchProvider {
  readonly name: string;
  search(query: string, options?: { maxResults?: number }): Promise<SearchQueryResult>;
}

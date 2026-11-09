import { ISearchProvider, SearchQueryResult, SearchEvidenceSource } from './types';

export interface TavilyConfig {
  apiKey: string;
  baseUrl?: string;
  maxResults?: number;
}

export class TavilySearchProvider implements ISearchProvider {
  readonly name = 'tavily';
  private apiKey: string;
  private baseUrl: string;
  private defaultMaxResults: number;

  constructor(config: TavilyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.tavily.com';
    this.defaultMaxResults = config.maxResults || 5;
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchQueryResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        query: '',
        sources: [],
        retrievedAt: new Date().toISOString(),
        provider: this.name,
      };
    }

    const maxResults = options?.maxResults || this.defaultMaxResults;

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query: trimmed,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        max_results: maxResults,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMessage = `Tavily API returned HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson?.message || errorJson?.error) {
          parsedMessage = errorJson.message || errorJson.error;
        }
      } catch {}

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Tavily authentication failed: ${parsedMessage}`);
      }
      if (response.status === 429) {
        throw new Error('Tavily search rate limit exceeded or quota exhausted.');
      }
      throw new Error(`Search provider error (${response.status}): ${parsedMessage}`);
    }

    const data: any = await response.json();
    const rawResults = Array.isArray(data?.results) ? data.results : [];

    // Filter duplicates and extract clean, useful source representations
    const seenUrls = new Set<string>();
    const sources: SearchEvidenceSource[] = [];

    for (const item of rawResults) {
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!url || seenUrls.has(url)) continue;
      seenUrls.add(url);

      const title = typeof item.title === 'string' ? item.title.trim() : 'Web Source';
      const content = typeof item.content === 'string' ? item.content.trim() : '';
      const publishedDate = typeof item.published_date === 'string' ? item.published_date : undefined;
      const score = typeof item.score === 'number' ? item.score : undefined;

      sources.push({
        title,
        url,
        content: content.slice(0, 1200), // bounded evidence chunk
        publishedDate,
        score,
      });
    }

    return {
      query: trimmed,
      sources,
      retrievedAt: new Date().toISOString(),
      provider: this.name,
    };
  }
}

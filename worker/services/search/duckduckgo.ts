import { ISearchProvider, SearchQueryResult, SearchEvidenceSource } from './types';

export interface DuckDuckGoConfig {
  maxResults?: number;
}

export class DuckDuckGoSearchProvider implements ISearchProvider {
  readonly name = 'duckduckgo';
  private defaultMaxResults: number;

  constructor(config?: DuckDuckGoConfig) {
    this.defaultMaxResults = config?.maxResults || 5;
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
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP status ${response.status}`);
      }

      const html = await response.text();
      const sources: SearchEvidenceSource[] = [];
      const seenUrls = new Set<string>();

      const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]*)">([\s\S]*?)<\/a>/g;
      const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      const titles: { url: string; title: string }[] = [];
      let m: RegExpExecArray | null;

      while ((m = linkRegex.exec(html)) !== null && titles.length < maxResults * 2) {
        let rawUrl = m[1];
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          rawUrl = decodeURIComponent(uddgMatch[1]);
        }
        if (rawUrl.startsWith('//')) {
          rawUrl = 'https:' + rawUrl;
        }

        const cleanTitle = m[2]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .trim();

        if (rawUrl && cleanTitle && !seenUrls.has(rawUrl)) {
          seenUrls.add(rawUrl);
          titles.push({ url: rawUrl, title: cleanTitle });
        }
      }

      const snippets: string[] = [];
      while ((m = snippetRegex.exec(html)) !== null && snippets.length < maxResults * 2) {
        const cleanSnippet = m[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .trim();
        snippets.push(cleanSnippet);
      }

      for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
        sources.push({
          title: titles[i].title,
          url: titles[i].url,
          content: (snippets[i] || titles[i].title).slice(0, 1200),
          publishedDate: 'Recent',
        });
      }

      return {
        query: trimmed,
        sources,
        retrievedAt: new Date().toISOString(),
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Web search retrieval failed';
      throw new Error(`DuckDuckGo web search provider error: ${msg}`);
    }
  }
}

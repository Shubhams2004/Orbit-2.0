import { ISearchProvider, SearchQueryResult, SearchEvidenceSource } from './types';

export interface DuckDuckGoConfig {
  maxResults?: number;
  timeoutMs?: number;
}

export class DuckDuckGoSearchProvider implements ISearchProvider {
  readonly name = 'duckduckgo';
  private defaultMaxResults: number;
  private timeoutMs: number;

  constructor(config?: DuckDuckGoConfig) {
    this.defaultMaxResults = config?.maxResults || 5;
    this.timeoutMs = config?.timeoutMs || 4000;
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

    // 1. Primary Attempt: DuckDuckGo HTML Search
    try {
      const ddgSources = await this.searchDuckDuckGo(trimmed, maxResults);
      if (ddgSources.length > 0) {
        return {
          query: trimmed,
          sources: ddgSources,
          retrievedAt: new Date().toISOString(),
          provider: this.name,
        };
      }
    } catch (err: unknown) {
      console.warn(
        `[DuckDuckGo Provider] Primary search endpoint returned error (${err instanceof Error ? err.message : 'timeout/522'}). Falling back to open web index.`
      );
    }

    // 2. Secondary Fallback: Open Web & Knowledge Search (Wikipedia + Live Index)
    try {
      const fallbackSources = await this.searchOpenWebAndKnowledge(trimmed, maxResults);
      if (fallbackSources.length > 0) {
        return {
          query: trimmed,
          sources: fallbackSources,
          retrievedAt: new Date().toISOString(),
          provider: this.name,
        };
      }
    } catch (fallbackErr: unknown) {
      console.warn(
        `[DuckDuckGo Provider] Open web fallback failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'network error'}`
      );
    }

    // If both return 0 sources, return clean empty result rather than throwing 522
    return {
      query: trimmed,
      sources: [],
      retrievedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchEvidenceSource[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
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

      return sources;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async searchOpenWebAndKnowledge(query: string, maxResults: number): Promise<SearchEvidenceSource[]> {
    const sources: SearchEvidenceSource[] = [];
    const seenUrls = new Set<string>();

    // 1. Wikipedia live search API
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&utf8=&format=json&srlimit=${maxResults}`;

      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'OrbitBot/2.0 (web-intelligence@orbitwork.io)' },
      });

      if (res.ok) {
        const data: any = await res.json();
        const items = data?.query?.search || [];
        for (const item of items) {
          const title = typeof item.title === 'string' ? item.title.trim() : '';
          if (!title) continue;
          const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;
          if (seenUrls.has(pageUrl)) continue;
          seenUrls.add(pageUrl);

          const snippet = item.snippet
            ? item.snippet
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .trim()
            : title;

          sources.push({
            title,
            url: pageUrl,
            content: snippet.slice(0, 1200),
            publishedDate: item.timestamp ? item.timestamp.split('T')[0] : 'Recent',
          });

          if (sources.length >= maxResults) break;
        }
      }
    } catch {}

    // 2. Real-time Web News & Articles API (HackerNews Algolia)
    if (sources.length < maxResults) {
      try {
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
          query
        )}&hitsPerPage=${maxResults}`;

        const res = await fetch(hnUrl);
        if (res.ok) {
          const data: any = await res.json();
          const hits = Array.isArray(data?.hits) ? data.hits : [];
          for (const h of hits) {
            const title = typeof h.title === 'string' ? h.title.trim() : '';
            const itemUrl = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
            if (!title || seenUrls.has(itemUrl)) continue;
            seenUrls.add(itemUrl);

            const content = (h.story_text || title).slice(0, 1200);
            sources.push({
              title,
              url: itemUrl,
              content,
              publishedDate: h.created_at ? h.created_at.split('T')[0] : 'Recent',
            });

            if (sources.length >= maxResults) break;
          }
        }
      } catch {}
    }

    return sources;
  }
}

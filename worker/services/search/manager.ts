import { ISearchProvider, SearchQueryResult } from './types';

interface CacheEntry {
  result: SearchQueryResult;
  expiresAt: number;
}

export class SearchManager {
  private provider: ISearchProvider | null;
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTtlMs: number;
  private maxCacheEntries: number;

  constructor(provider: ISearchProvider | null, options?: { ttlMs?: number; maxCacheEntries?: number }) {
    this.provider = provider;
    this.defaultTtlMs = options?.ttlMs || 10 * 60 * 1000; // 10 minutes cache
    this.maxCacheEntries = options?.maxCacheEntries || 100;
  }

  isConfigured(): boolean {
    return this.provider !== null;
  }

  getProviderName(): string {
    return this.provider ? this.provider.name : 'none';
  }

  /**
   * Intelligently detects whether a user prompt requires live/current internet information.
   * Avoids searching for ordinary conversational prompts, tasks planning, code reviews, or local math/logic.
   */
  shouldSearch(prompt: string, explicitMode?: boolean): boolean {
    if (explicitMode === true) return true;
    if (explicitMode === false) return false;

    const lower = prompt.toLowerCase().trim();

    // Avoid searching for short conversational banter
    if (lower.length < 8) return false;
    if (/^(hi|hello|hey|good morning|thanks|thank you|who are you|how are you|test)\b/i.test(lower)) {
      return false;
    }

    // Avoid searching for internal workspace actions (tasks, projects, kanban)
    if (
      /\b(create task|my tasks|list projects|reschedule|mark done|plan my day|triage my workload)\b/i.test(
        lower
      )
    ) {
      return false;
    }

    // Strong intent triggers for internet search
    const liveKeywords = [
      'latest',
      'current',
      'recent',
      'today',
      'news',
      'price of',
      'weather',
      'release date',
      'released',
      'changelog',
      'who won',
      'stock price',
      'what happened',
      'search the web',
      'search for',
      'look up',
      'find online',
      'browse',
      'documentation for',
      'specs of',
      'status of',
      '2025',
      '2026',
    ];

    for (const kw of liveKeywords) {
      if (lower.includes(kw)) {
        return true;
      }
    }

    // Question words about current status or external facts
    if (/^(what is the latest|who is the current|what happened to|is .* down|how much does .* cost)\b/i.test(lower)) {
      return true;
    }

    return false;
  }

  /**
   * Performs an optimized, cached search using the configured provider.
   */
  async search(query: string, options?: { maxResults?: number; forceFresh?: boolean }): Promise<SearchQueryResult> {
    if (!this.provider) {
      throw new Error(
        'Web search provider is not configured. Please configure TAVILY_API_KEY in Worker environment variables.'
      );
    }

    const normalizedKey = query.toLowerCase().trim();
    const now = Date.now();

    // Check cache
    if (!options?.forceFresh && this.cache.has(normalizedKey)) {
      const entry = this.cache.get(normalizedKey)!;
      if (entry.expiresAt > now) {
        return {
          ...entry.result,
          cached: true,
        };
      }
      this.cache.delete(normalizedKey);
    }

    // Execute provider search
    const result = await this.provider.search(query, { maxResults: options?.maxResults || 5 });

    // Store in cache with LRU purge if capacity reached
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(normalizedKey, {
      result,
      expiresAt: now + this.defaultTtlMs,
    });

    return result;
  }

  /**
   * Clears the in-memory cache (useful for tests or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

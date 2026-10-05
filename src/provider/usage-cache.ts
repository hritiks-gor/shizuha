/**
 * Provider cache counters, copied only when the response reports them.
 * A missing field stays unknown. A present 0 is a measured miss.
 */

export interface ReportedUsageCache {
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

function nonNegativeFinite(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function detailsCache(details: unknown): number | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const rec = details as Record<string, unknown>;
  return nonNegativeFinite(rec.cached_tokens) ?? nonNegativeFinite(rec.cache_read_tokens);
}

/** Read cached-input and cache-write counts from a Responses or Chat Completions usage object. */
export function usageCacheFromRecord(usage: object | null | undefined): ReportedUsageCache {
  if (!usage) return {};
  const rec = usage as Record<string, unknown>;
  const cacheRead = detailsCache(rec.input_tokens_details)
    ?? detailsCache(rec.prompt_tokens_details)
    ?? nonNegativeFinite(rec.cache_read_input_tokens)
    ?? nonNegativeFinite(rec.cacheReadInputTokens)
    ?? nonNegativeFinite(rec.cache_read_tokens)
    ?? nonNegativeFinite(rec.cached_tokens);
  const cacheCreation = nonNegativeFinite(rec.cache_creation_input_tokens)
    ?? nonNegativeFinite(rec.cacheCreationInputTokens);
  return {
    ...(cacheRead !== undefined ? { cacheReadInputTokens: cacheRead } : {}),
    ...(cacheCreation !== undefined ? { cacheCreationInputTokens: cacheCreation } : {}),
  };
}

/**
 * Usage chunk fields for one Responses `response.completed` / `response.incomplete` payload.
 * Returns null when the event carried no usage at all.
 */
export function responsesUsageChunk(usage: object | null | undefined): {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
} | null {
  if (!usage) return null;
  const rec = usage as Record<string, unknown>;
  const inputTokens = nonNegativeFinite(rec.input_tokens) ?? 0;
  const outputTokens = nonNegativeFinite(rec.output_tokens) ?? 0;
  const cache = usageCacheFromRecord(usage);
  if (
    !inputTokens
    && !outputTokens
    && cache.cacheReadInputTokens == null
    && cache.cacheCreationInputTokens == null
  ) {
    return null;
  }
  return { inputTokens, outputTokens, ...cache };
}

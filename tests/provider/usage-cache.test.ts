import { describe, it, expect } from 'vitest';
import { responsesUsageChunk, usageCacheFromRecord } from '../../src/provider/usage-cache.js';

describe('usage cache counters', () => {
  it('copies Responses cached_tokens and keeps a measured zero', () => {
    expect(responsesUsageChunk({
      input_tokens: 72198,
      output_tokens: 3517,
      input_tokens_details: { cached_tokens: 70528 },
    })).toEqual({
      inputTokens: 72198,
      outputTokens: 3517,
      cacheReadInputTokens: 70528,
    });
    expect(responsesUsageChunk({
      input_tokens: 100,
      output_tokens: 1,
      input_tokens_details: { cached_tokens: 0 },
    })?.cacheReadInputTokens).toBe(0);
  });

  it('does not treat a missing cache field as zero', () => {
    const parsed = responsesUsageChunk({ input_tokens: 10, output_tokens: 2 });
    expect(parsed).toEqual({ inputTokens: 10, outputTokens: 2 });
    expect(parsed).not.toHaveProperty('cacheReadInputTokens');
    expect(usageCacheFromRecord(undefined)).toEqual({});
    expect(responsesUsageChunk(null)).toBeNull();
  });

  it('reads Chat Completions prompt_tokens_details and cache writes', () => {
    expect(usageCacheFromRecord({
      prompt_tokens: 50,
      prompt_tokens_details: { cached_tokens: 12 },
      cache_creation_input_tokens: 3,
    })).toEqual({
      cacheReadInputTokens: 12,
      cacheCreationInputTokens: 3,
    });
  });
});

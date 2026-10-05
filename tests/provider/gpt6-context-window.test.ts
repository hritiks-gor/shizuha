import { describe, it, expect } from 'vitest';
import { CodexProvider } from '../../src/provider/codex.js';
import {
  GPT6_CATALOG_MAX_CONTEXT_WINDOW,
  resolveEffectiveContextWindow,
  resolveModelContextWindow,
  sanitizeServedContextWindow,
  resolveDynamicCompactionWindow,
} from '../../src/provider/context-window.js';
import { buildGptCodexProviderArgs } from '../../src/codex-bridge/index.js';

describe('gpt-6 catalog context window', () => {
  it('plans gpt-6-astra/sol/luna at the Codex catalog max, not 1.05M or 272k', () => {
    expect(GPT6_CATALOG_MAX_CONTEXT_WINDOW).toBe(872000);
    expect(resolveModelContextWindow('gpt-6-astra')).toBe(872000);
    expect(resolveModelContextWindow('openai/gpt-6-sol')).toBe(872000);
    expect(resolveModelContextWindow('codex/gpt-6-luna')).toBe(872000);
    expect(resolveModelContextWindow('grok-4.7')).toBe(500000);
    expect(resolveModelContextWindow('grok-4')).toBe(256000);
  });

  it('lifts the 272k constructor default only when the model default is higher and contextWindowFor is absent', () => {
    const bundled = { maxContextWindow: 272000 };
    expect(resolveEffectiveContextWindow('gpt-6-astra', bundled)).toBe(872000);
    expect(resolveEffectiveContextWindow('gpt-5.3-codex-spark', bundled)).toBe(272000);
    expect(resolveEffectiveContextWindow('gpt-6-astra', {
      maxContextWindow: 272000,
      contextWindowFor: () => 872000,
    })).toBe(872000);
    expect(resolveEffectiveContextWindow('gpt-6-astra', {
      maxContextWindow: 872000,
      contextWindowFor: () => 272000,
    })).toBe(272000);
  });

  it('does not rewrite a served 272k window upward', () => {
    expect(sanitizeServedContextWindow('gpt-6-astra', 272000)).toBe(272000);
    expect(resolveDynamicCompactionWindow({
      requestedModel: 'gpt-6-astra',
      servedModel: 'gpt-6-astra',
      servedContextWindow: 272000,
    })).toBe(272000);
  });

  it('CodexProvider.contextWindowFor reports the catalog max for gpt-6 and 272k for gpt-5', () => {
    const provider = new CodexProvider([{
      authMode: 'chatgpt',
      email: 'fixture',
      accessToken: 'token',
      refreshToken: '',
      accountId: 'acct',
      authPath: '',
    }]);
    expect(provider.contextWindowFor('gpt-6-astra')).toBe(872000);
    expect(provider.contextWindowFor('openai/gpt-6-sol')).toBe(872000);
    expect(provider.contextWindowFor('gpt-5.5')).toBe(272000);
    expect(provider.maxContextWindow).toBe(272000);
  });

  it('passes model_context_window only for gpt-6 catalog slugs', () => {
    const astra = buildGptCodexProviderArgs('gpt-6-astra', null).join(' ');
    const gpt5 = buildGptCodexProviderArgs('gpt-5.5', null).join(' ');
    expect(astra).toContain('model_context_window=872000');
    expect(astra).toContain('model_provider=chatgpt-http');
    expect(gpt5).not.toContain('model_context_window');
  });
});

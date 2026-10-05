import { describe, expect, it } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolRegistry } from '../../src/tools/registry.js';
import { toolSearchTool } from '../../src/tools/builtin/tool-search.js';
import {
  isCodexSchemaRejection,
  toResponsesParameterSchema,
} from '../../src/provider/responses-schema.js';
import { isTransientProviderFailure } from '../../src/provider/transient-errors.js';

const NUMERIC_KEYWORDS = new Set([
  'multipleOf', 'maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum',
  'maxLength', 'minLength', 'maxItems', 'minItems', 'maxProperties', 'minProperties',
  'maxContains', 'minContains',
]);

function booleanNumericKeywords(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => booleanNumericKeywords(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  const hits: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (NUMERIC_KEYWORDS.has(key) && typeof nested === 'boolean') hits.push(`${path}.${key}`);
    hits.push(...booleanNumericKeywords(nested, `${path}.${key}`));
  }
  return hits;
}

describe('ChatGPT responses function schemas', () => {
  it('emits ToolSearch parameters ChatGPT can validate', () => {
    const registry = new ToolRegistry();
    registry.register(toolSearchTool);
    const definition = registry.definitions().find((tool) => tool.name === 'ToolSearch');
    expect(definition).toBeTruthy();
    const raw = definition!.inputSchema;
    const maxResults = (raw.properties as Record<string, Record<string, unknown>>).max_results;
    expect(maxResults.minimum).toBe(1);
    expect(maxResults.exclusiveMinimum).toBeUndefined();
    expect(booleanNumericKeywords(raw)).toEqual([]);

    const wire = toResponsesParameterSchema(raw);
    expect(booleanNumericKeywords(wire)).toEqual([]);
    expect(wire.additionalProperties).toBe(false);
  });

  it('rewrites the openApi3 boolean exclusiveMinimum that ChatGPT rejected', () => {
    const historical = zodToJsonSchema(
      toolSearchTool.parameters,
      { target: 'openApi3' },
    ) as Record<string, unknown>;
    // The live 400 was this shape when the field was Zod .positive().
    const broken = {
      type: 'object',
      additionalProperties: false,
      properties: {
        max_results: {
          type: 'integer',
          exclusiveMinimum: true,
          minimum: 0,
          default: 3,
        },
        nested: {
          type: 'object',
          properties: {
            cap: { type: 'integer', exclusiveMaximum: true, maximum: 10 },
          },
        },
        items: { type: 'array', maxItems: true },
      },
    };
    expect(booleanNumericKeywords(broken).length).toBeGreaterThan(0);
    const wire = toResponsesParameterSchema(broken);
    expect(booleanNumericKeywords(wire)).toEqual([]);
    const maxResults = (wire.properties as Record<string, Record<string, unknown>>).max_results;
    expect(maxResults.exclusiveMinimum).toBe(0);
    expect(maxResults.minimum).toBeUndefined();
    expect(maxResults.default).toBe(3);
    const cap = (((wire.properties as Record<string, Record<string, unknown>>).nested.properties as Record<string, Record<string, unknown>>).cap);
    expect(cap.exclusiveMaximum).toBe(10);
    expect(cap.maximum).toBeUndefined();
    expect((wire.properties as Record<string, Record<string, unknown>>).items.maxItems).toBeUndefined();
    expect(wire.additionalProperties).toBe(false);
    expect(booleanNumericKeywords(historical)).toEqual([]);
  });

  it('does not retry a ToolSearch schema 400', () => {
    const message = "400 Invalid schema for function 'ToolSearch': True is not of type 'number'.";
    expect(isCodexSchemaRejection(400, message)).toBe(true);
    expect(isCodexSchemaRejection(400, 'service_tier is not supported')).toBe(false);
    expect(isCodexSchemaRejection(500, message)).toBe(false);
    expect(isTransientProviderFailure({
      status: 400,
      code: 'invalid_function_parameters',
      message,
    })).toBe(false);
  });
});

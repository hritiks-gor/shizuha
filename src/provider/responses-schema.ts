/**
 * ChatGPT Responses validates function.parameters as JSON Schema, where
 * exclusiveMinimum / exclusiveMaximum are numbers.
 *
 * zod-to-json-schema target openApi3 emits the draft-04 boolean form
 * (`exclusiveMinimum: true` beside `minimum: 0`) for Zod `.positive()`.
 * That boolean is the live 400:
 * `Invalid schema for function 'ToolSearch': True is not of type 'number'`.
 * Tools that use `.min(1)` emit a numeric `minimum` and pass.
 */

const NUMERIC_SCHEMA_KEYWORDS = [
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'maxItems',
  'minItems',
  'maxProperties',
  'minProperties',
  'maxContains',
  'minContains',
] as const;

function liftExclusiveBound(
  schema: Record<string, unknown>,
  exclusiveKey: 'exclusiveMinimum' | 'exclusiveMaximum',
  boundKey: 'minimum' | 'maximum',
): void {
  const flag = schema[exclusiveKey];
  if (typeof flag !== 'boolean') return;
  if (flag === true && typeof schema[boundKey] === 'number') {
    schema[exclusiveKey] = schema[boundKey];
    delete schema[boundKey];
    return;
  }
  delete schema[exclusiveKey];
}

function rewrite(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = rewrite(nested);
  }
  liftExclusiveBound(out, 'exclusiveMinimum', 'minimum');
  liftExclusiveBound(out, 'exclusiveMaximum', 'maximum');
  for (const key of NUMERIC_SCHEMA_KEYWORDS) {
    if (typeof out[key] === 'boolean') delete out[key];
  }
  return out;
}

export function toResponsesParameterSchema(schema: unknown): Record<string, unknown> {
  const cleaned = rewrite(schema);
  if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) {
    return cleaned as Record<string, unknown>;
  }
  return { type: 'object', properties: {} };
}

/** A function-schema 400 cannot be repaired by dropping reasoning or service_tier. */
export function isCodexSchemaRejection(status: number | undefined, message: string): boolean {
  if (status !== 400) return false;
  return /invalid schema for function/i.test(message)
    || /invalid_function_parameters/i.test(message);
}

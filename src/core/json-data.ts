// JSON helpers: parsing with a readable error message and non-destructive merging.

export type JsonObject = Record<string, unknown>;

export type JsonParseResult =
  | { ok: true; value: JsonObject }
  | { ok: false; error: string };

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// V8 only reports the character position ("... at position 42"); this is turned into "line x, column y".
function describePosition(text: string, message: string): string {
  const match = /position (\d+)/.exec(message);
  if (!match) return message;
  const position = Math.min(Number(match[1]), text.length);
  const before = text.slice(0, position);
  const line = before.split("\n").length;
  const column = position - before.lastIndexOf("\n");
  return `${message.replace(/\s*\(line \d+ column \d+\)/, "")} (Zeile ${line}, Spalte ${column})`;
}

export function parseJsonObject(text: string): JsonParseResult {
  try {
    const value: unknown = JSON.parse(text);
    if (!isPlainObject(value)) {
      return { ok: false, error: "The JSON must be an object ({ ... })." };
    }
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: describePosition(text, message) };
  }
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export interface MergeResult {
  merged: JsonObject;
  // Paths that were newly added (e.g. "invoice.vatRate").
  added: string[];
}

// Adds missing keys from `source`. Existing values (including arrays) stay unchanged.
export function mergeMissing(target: JsonObject, source: JsonObject): MergeResult {
  const added: string[] = [];

  const merge = (base: JsonObject, extra: JsonObject, prefix: string): JsonObject => {
    const result: JsonObject = { ...base };
    for (const [key, extraValue] of Object.entries(extra)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in result)) {
        result[key] = structuredClone(extraValue);
        added.push(path);
      } else if (isPlainObject(result[key]) && isPlainObject(extraValue)) {
        result[key] = merge(result[key], extraValue, path);
      }
    }
    return result;
  };

  return { merged: merge(target, source, ""), added };
}

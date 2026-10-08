import Handlebars from "handlebars";

import { isPlainObject, type JsonObject } from "./json-data";

// Shared Handlebars setup. The same engine renders the browser preview and the server-side PDF,
// so both produce exactly the same HTML.

export interface TemplateEngineOptions {
  // BCP 47 locale used by the number, money and date helpers. Default: "en-GB".
  locale?: string;
  // ISO 4217 currency code used by the money helper. Default: "GBP".
  currency?: string;
  // Additional helpers; they may override the built-in ones.
  helpers?: Record<string, Handlebars.HelperDelegate>;
}

export type RenderResult = { ok: true; html: string } | { ok: false; error: string };

export interface TemplateEngine {
  // Handlebars compiles lazily: syntax errors (e.g. incomplete "{{#each") only throw at render time.
  render(template: string, data: JsonObject): RenderResult;
  // For plain text (header/footer): no HTML escaping; on error the text stays unchanged.
  renderPlainText(template: string, data: JsonObject): string;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

// Handlebars always appends an options object as the last argument.
function isOptions(value: unknown): value is Handlebars.HelperOptions {
  return typeof value === "object" && value !== null && "hash" in value && "data" in value;
}

function createHandlebars({ locale = "en-GB", currency = "GBP", helpers = {} }: TemplateEngineOptions): typeof Handlebars {
  const hbs = Handlebars.create();
  const currencyFormat = new Intl.NumberFormat(locale, { style: "currency", currency });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  hbs.registerHelper("money", (value: unknown) => currencyFormat.format(toNumber(value)));

  hbs.registerHelper("number", (value: unknown, decimals?: unknown) => {
    const digits = isOptions(decimals) || decimals === undefined ? 2 : toNumber(decimals);
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(toNumber(value));
  });

  // ISO date (YYYY-MM-DD) -> "8 Oct 2026", without time zone effects.
  hbs.registerHelper("date", (value: unknown) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
    return match ? dateFormat.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))) : String(value ?? "");
  });

  hbs.registerHelper("multiply", (a: unknown, b: unknown) => toNumber(a) * toNumber(b));
  hbs.registerHelper("add", (a: unknown, b: unknown) => toNumber(a) + toNumber(b));
  hbs.registerHelper("inc", (value: unknown) => toNumber(value) + 1);
  hbs.registerHelper("percent", (value: unknown, rate: unknown) => (toNumber(value) * toNumber(rate)) / 100);

  // Sum of a column, or sum of the product of two columns, over an array.
  hbs.registerHelper("sum", (list: unknown, key: unknown) =>
    Array.isArray(list)
      ? list.reduce((total: number, item) => total + toNumber(isPlainObject(item) ? item[String(key)] : item), 0)
      : 0,
  );
  hbs.registerHelper("sumProduct", (list: unknown, keyA: unknown, keyB: unknown) =>
    Array.isArray(list)
      ? list.reduce(
          (total: number, item) =>
            isPlainObject(item) ? total + toNumber(item[String(keyA)]) * toNumber(item[String(keyB)]) : total,
          0,
        )
      : 0,
  );

  hbs.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  hbs.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
  hbs.registerHelper("gt", (a: unknown, b: unknown) => toNumber(a) > toNumber(b));
  hbs.registerHelper("lt", (a: unknown, b: unknown) => toNumber(a) < toNumber(b));

  for (const [name, helper] of Object.entries(helpers)) hbs.registerHelper(name, helper);

  return hbs;
}

export function createTemplateEngine(options: TemplateEngineOptions = {}): TemplateEngine {
  const hbs = createHandlebars(options);
  return {
    render(template, data) {
      try {
        return { ok: true, html: hbs.compile(template)(data) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    renderPlainText(template, data) {
      try {
        return hbs.compile(template, { noEscape: true })(data);
      } catch {
        return template;
      }
    },
  };
}

// Engine with the default options; used wherever no engine is passed explicitly.
export const defaultEngine: TemplateEngine = createTemplateEngine();

export function renderTemplate(template: string, data: JsonObject): RenderResult {
  return defaultEngine.render(template, data);
}

export function renderPlainText(template: string, data: JsonObject): string {
  return defaultEngine.renderPlainText(template, data);
}

// ---------------------------------------------------------------------------
// Derive variables and loops from the JSON keys
// ---------------------------------------------------------------------------

export interface VariableOption {
  path: string;
  // Ready-made text for the editor, e.g. "{{customer.name}}".
  expression: string;
  sample: string;
}

export interface LoopOption {
  path: string;
  itemFields: string[];
  length: number;
  // Three lines: opening tag, example row, closing tag.
  lines: [string, string, string];
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function segment(key: string): string | null {
  if (IDENTIFIER.test(key)) return key;
  return key.includes("]") ? null : `[${key}]`;
}

function leafPaths(value: unknown, prefix: string, depth: number, out: Set<string>) {
  if (isPlainObject(value)) {
    if (depth >= 3) return;
    for (const [key, child] of Object.entries(value)) {
      const seg = segment(key);
      if (seg) leafPaths(child, prefix ? `${prefix}.${seg}` : seg, depth + 1, out);
    }
  } else if (!Array.isArray(value)) {
    out.add(prefix);
  }
}

export function extractVariablePaths(data: JsonObject): {
  variables: VariableOption[];
  loops: LoopOption[];
} {
  const variables: VariableOption[] = [];
  const loops: LoopOption[] = [];

  const walk = (value: unknown, path: string, depth: number) => {
    if (Array.isArray(value)) {
      const fields = new Set<string>();
      for (const item of value.slice(0, 5)) {
        if (isPlainObject(item)) leafPaths(item, "", 0, fields);
        else fields.add("this");
      }
      const itemFields = [...fields];
      const row = itemFields
        .slice(0, 4)
        .map((field) => `{{${field}}}`)
        .join(" · ");
      loops.push({
        path,
        itemFields,
        length: value.length,
        lines: [`{{#each ${path}}}`, row || "{{this}}", "{{/each}}"],
      });
    } else if (isPlainObject(value)) {
      if (depth >= 5) return;
      for (const [key, child] of Object.entries(value)) {
        const seg = segment(key);
        if (seg) walk(child, path ? `${path}.${seg}` : seg, depth + 1);
      }
    } else if (path) {
      variables.push({ path, expression: `{{${path}}}`, sample: String(value ?? "") });
    }
  };

  walk(data, "", 0);
  return { variables, loops };
}

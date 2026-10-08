import { parseAssets } from "./assets";
import type { DocumentInput } from "./render";
import { parseFormFields } from "./form-fields";
import { isPlainObject } from "./json-data";
import { emptySettings, parseSettings } from "./page-settings";

const KIND = /^[a-z][a-z0-9-]{0,31}$/;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Validates an untrusted value (request body, localStorage, ...) and normalises it into a DocumentInput.
// Settings, assets and form fields are sanitised; unknown or malformed parts fall back to defaults.
export function parseDocumentInput(value: unknown): ParseResult<DocumentInput> {
  if (!isPlainObject(value) || typeof value.template !== "string" || !isPlainObject(value.data)) {
    return { ok: false, error: 'Expected { "template": string, "data": object }.' };
  }

  const title = typeof value.title === "string" && value.title.trim() ? value.title.trim().slice(0, 200) : "Document";
  const kind = typeof value.kind === "string" && KIND.test(value.kind) ? value.kind : "invoice";

  return {
    ok: true,
    value: {
      template: value.template,
      data: value.data,
      title,
      kind,
      settings: parseSettings(value.settings, emptySettings()),
      assets: parseAssets(value.assets),
      fields: parseFormFields(value.fields),
    },
  };
}

import { buildDocumentHtml, type DocumentKind, type DocumentTarget } from "./document-html";
import type { AssetMap } from "./assets";
import type { FieldMap } from "./form-fields";
import { defaultEngine, type TemplateEngine } from "./handlebars";
import type { JsonObject } from "./json-data";
import type { DocumentSettings } from "./page-settings";

// Everything that describes one document: the unprocessed Handlebars template plus its data.
export interface DocumentInput {
  // HTML with Handlebars placeholders, as exported by the editor.
  template: string;
  // Values for the placeholders.
  data: JsonObject;
  // PDF title; also used for the file name.
  title?: string;
  kind?: DocumentKind;
  // Page margins, header/footer and page number.
  settings?: DocumentSettings;
  // Images referenced as <img src="asset:ID"> in the template or the header/footer.
  assets?: AssetMap;
  // Fillable form field definitions referenced by <span data-form-field="ID">.
  fields?: FieldMap;
}

export interface RenderDocumentOptions {
  target?: DocumentTarget;
  // Stylesheet; defaults to the built-in `documentCss`.
  css?: string;
  engine?: TemplateEngine;
  language?: string;
  compact?: boolean;
}

export type RenderDocumentResult =
  | { ok: true; html: string; body: string }
  | { ok: false; error: string };

// Renders the template with the data and wraps the result into a complete HTML document.
export function renderDocument(
  input: DocumentInput,
  { target = "pdf", css, engine = defaultEngine, language, compact }: RenderDocumentOptions = {},
): RenderDocumentResult {
  const rendered = engine.render(input.template, input.data);
  if (!rendered.ok) return rendered;

  const html = buildDocumentHtml({
    body: rendered.html,
    css,
    title: input.title,
    kind: input.kind,
    target,
    language,
    compact,
    data: input.data,
    settings: input.settings,
    assets: input.assets,
    fields: input.fields,
    engine,
  });
  return { ok: true, html, body: rendered.html };
}

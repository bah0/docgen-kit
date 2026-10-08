import { resolveAssetUrls, type AssetMap } from "./assets";
import { documentCss } from "./document-css";
import { escapeHtml } from "./escape-html";
import { resolveFormFields, type FieldMap } from "./form-fields";
import { defaultEngine, type TemplateEngine } from "./handlebars";
import type { JsonObject } from "./json-data";
import { marginVariablesCss, pageDecorToCss, pageDecorToHtml, resolvePageDecor } from "./page-decor";
import { emptySettings, type DocumentSettings } from "./page-settings";

// Built-in kinds get matching styles in the default stylesheet (`document--<kind>`); any other
// string only adds a CSS class you can target in your own stylesheet.
export type DocumentKind = "invoice" | "contract" | "block" | (string & {});

// Builds the complete HTML document around the rendered template content.
// Browser (iframe srcDoc) and server (Gotenberg index.html) use the same function
// and the same stylesheet – so they differ only in @media evaluation
// (screen vs. print). Images, margins and header/footer live in the same HTML.

// A4 at 96 dpi; equals 210mm in CSS.
export const A4_WIDTH_PX = 794;
// Horizontal space for the sheet shadow in the preview (two margins).
export const PREVIEW_GUTTER_PX = 24;

export type DocumentTarget = "preview" | "pdf";

export interface BuildDocumentOptions {
  // Content already rendered by Handlebars.
  body: string;
  // Stylesheet; defaults to the built-in `documentCss`.
  css?: string;
  title?: string;
  kind?: DocumentKind;
  target: DocumentTarget;
  // Value of the `lang` attribute (hyphenation, screen readers). Default: "en".
  language?: string;
  // Preview only: one continuous strip without pages (block library).
  compact?: boolean;
  // Data for the placeholders in header/footer.
  data?: JsonObject;
  settings?: DocumentSettings;
  assets?: AssetMap;
  // Form fields: placeholders become boxes (preview) or links for pdf-lib (PDF).
  fields?: FieldMap;
  // Template engine used for the header/footer text.
  engine?: TemplateEngine;
}

export function buildDocumentHtml({
  body,
  css = documentCss,
  title = "Document",
  kind = "invoice",
  target,
  language = "en",
  compact = false,
  data = {},
  settings = emptySettings(),
  assets = {},
  fields = {},
  engine = defaultEngine,
}: BuildDocumentOptions): string {
  const bodyClass = target === "preview" ? (compact ? "is-preview is-compact" : "is-preview") : "is-pdf";
  const content = resolveFormFields(resolveAssetUrls(body, assets), fields, target);

  // The compact preview has no pages and therefore neither margins nor header/footer.
  let extraCss = "";
  let extraHtml = "";
  if (!compact) {
    const decor = resolvePageDecor(settings, assets, data, engine);
    if (target === "pdf") {
      extraCss = pageDecorToCss(decor);
    } else {
      extraCss = marginVariablesCss(decor.margins);
      extraHtml = `<template id="page-decor">${pageDecorToHtml(decor)}</template>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(language)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
${extraCss ? `<style>${extraCss}</style>` : ""}
</head>
<body class="${bodyClass}">
<main class="document document--${kind}">${content}</main>
${extraHtml}
</body>
</html>`;
}

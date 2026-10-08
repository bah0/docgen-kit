"use client";

import { DocumentPreview } from "docgen-kit/react";
import type { AssetMap, DocumentKind, DocumentSettings, FieldMap, JsonObject } from "docgen-kit";
import type { CSSProperties } from "react";

export interface A4IFramePreviewProps {
  // Unprocessed Handlebars template (comes from Lexical).
  htmlTemplate: string;
  // Variable values (from the JSON editor).
  data: JsonObject;
  kind?: DocumentKind;
  title?: string;
  settings?: DocumentSettings;
  assets?: AssetMap;
  fields?: FieldMap;
  // "page": separate A4 sheets as in the PDF. "compact": content only (block library).
  variant?: "page" | "compact";
  style?: CSSProperties;
}

// Demo styling around docgen-kit's DocumentPreview: error banner and page info use the app's Tailwind theme.
export function A4IFramePreview({ htmlTemplate, data, kind, title, settings, assets, fields, variant = "page", style }: A4IFramePreviewProps) {
  return (
    <DocumentPreview
      template={htmlTemplate}
      data={data}
      kind={kind}
      title={title}
      settings={settings}
      assets={assets}
      fields={fields}
      variant={variant}
      style={{ background: "color-mix(in oklab, var(--muted) 70%, transparent)", ...style }}
      header={({ error, pageCount, scale }) => (
        <>
          {error !== null && (
            <div role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <strong>Template error:</strong> {error}
              <div className="text-xs opacity-80">The last valid preview stays visible.</div>
            </div>
          )}
          {variant !== "compact" && (
            <p className="mb-2 text-center text-xs text-muted-foreground">
              A4 · {pageCount} {pageCount === 1 ? "page" : "pages"} · Zoom {Math.round(scale * 100)} % · Page breaks follow the
              CSS rules of the PDF; the PDF comparison remains authoritative
            </p>
          )}
        </>
      )}
    />
  );
}

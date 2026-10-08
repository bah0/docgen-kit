"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { AssetMap } from "../core/assets";
import { A4_WIDTH_PX, buildDocumentHtml, PREVIEW_GUTTER_PX, type DocumentKind } from "../core/document-html";
import type { FieldMap } from "../core/form-fields";
import { defaultEngine, type TemplateEngine } from "../core/handlebars";
import type { JsonObject } from "../core/json-data";
import type { DocumentSettings } from "../core/page-settings";
import { paginateDocument } from "../client/paginate";

const A4_HEIGHT_PX = Math.round((297 * 96) / 25.4);

export interface PreviewStatus {
  pageCount: number;
  // Zoom factor applied to fit the available width (never above 1).
  scale: number;
  // Template error of the current input; the preview keeps showing the last valid state.
  error: string | null;
}

export interface DocumentPreviewProps {
  // Unprocessed Handlebars template (e.g. exported from the editor).
  template: string;
  // Variable values.
  data: JsonObject;
  // Stylesheet; defaults to the built-in `documentCss`.
  css?: string;
  kind?: DocumentKind;
  title?: string;
  // Margins, header/footer and page number; images for <img src="asset:ID"> and the lines.
  settings?: DocumentSettings;
  assets?: AssetMap;
  // Form fields are shown as placeholder boxes.
  fields?: FieldMap;
  engine?: TemplateEngine;
  language?: string;
  // "page": separate A4 sheets as in the PDF. "compact": content only, no pages.
  variant?: "page" | "compact";
  // Rendered at the top of the scroll area, e.g. an error banner or a page count.
  header?: (status: PreviewStatus) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

// Live preview: Handlebars runs in the browser (useMemo), there is no server call.
//
// The document is isolated in a same-origin iframe without scripts and gets the same stylesheet as the PDF.
// After loading, `paginateDocument` builds individual A4 sheets from the column flow, so page breaks and
// margins look like in the PDF.
export function DocumentPreview({
  template,
  data,
  css,
  kind = "invoice",
  title = "Preview",
  settings,
  assets,
  fields,
  engine = defaultEngine,
  language,
  variant = "page",
  header,
  className,
  style,
}: DocumentPreviewProps) {
  const compact = variant === "compact";
  const rendered = useMemo(() => engine.render(template, data), [engine, template, data]);

  // On a template error (e.g. half-typed "{{#each") the last valid preview stays.
  const [lastGoodBody, setLastGoodBody] = useState(() => (rendered.ok ? rendered.html : ""));
  if (rendered.ok && rendered.html !== lastGoodBody) setLastGoodBody(rendered.html);

  const srcDoc = useMemo(
    () =>
      buildDocumentHtml({
        body: lastGoodBody,
        css,
        title,
        kind,
        target: "preview",
        language,
        compact,
        data,
        settings,
        assets,
        fields,
        engine,
      }),
    [lastGoodBody, css, title, kind, language, compact, data, settings, assets, fields, engine],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(compact ? 120 : A4_HEIGHT_PX);
  const [pageCount, setPageCount] = useState(1);

  // Scale the sheet to the available width (never enlarge).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      // Hidden tabs report width 0; keep the last usable value.
      if (entry.contentRect.width > 0) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // The sheets have room at the sides for their shadow (see .pages in the stylesheet).
  const frameWidth = compact ? A4_WIDTH_PX : A4_WIDTH_PX + PREVIEW_GUTTER_PX;
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / frameWidth) : 1;

  // The iframe is same-origin (sandbox="allow-same-origin", no scripts) and is stretched to content height.
  // A ResizeObserver catches late layout changes (e.g. fonts loaded afterwards).
  const handleLoad = () => {
    observerRef.current?.disconnect();
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const pages = paginateDocument(doc);
    if (pages > 0) setPageCount(pages);
    const update = () => setContentHeight(Math.max(Math.ceil(doc.documentElement.scrollHeight), 1));
    update();
    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(doc.body);
  };

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const status: PreviewStatus = { pageCount, scale, error: rendered.ok ? null : rendered.error };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", height: "100%", overflow: "auto", boxSizing: "border-box", padding: 16, background: "#e5e7eb", ...style }}
    >
      {header?.(status)}
      <div style={{ width: frameWidth * scale, height: contentHeight * scale, margin: "0 auto" }}>
        <iframe
          ref={iframeRef}
          title={`${title} – live preview`}
          srcDoc={srcDoc}
          sandbox="allow-same-origin"
          onLoad={handleLoad}
          style={{
            display: "block",
            border: 0,
            width: frameWidth,
            height: contentHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            ...(compact ? { background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.15)" } : null),
          }}
        />
      </div>
    </div>
  );
}

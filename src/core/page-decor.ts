import { hasAsset, sizedImageUri, type AssetMap, type ImageAsset } from "./assets";
import { escapeHtml } from "./escape-html";
import { defaultEngine, type TemplateEngine } from "./handlebars";
import type { JsonObject } from "./json-data";
import {
  IMAGE_HEIGHT_LIMITS,
  SLOT_POSITIONS,
  type DocumentSettings,
  type PageBand,
  type PageMargins,
  type PageNumberPosition,
  type SlotPosition,
} from "./page-settings";

// Header/footer and page number, resolved once (Handlebars text rendered, images found) and then
// output in two forms:
//  - PDF: CSS page margin boxes (@page { @top-left { ... } }) in the same HTML as the content. Gotenberg sees
//    only this one HTML, no separate header.html/footer.html.
//  - Preview: a <template> from which paginate.ts fills the margins of each sheet.
// Both follow the same model: three fields (left, center, right) per margin, content = image + text (+ page number).

export interface ResolvedSlot {
  text: string;
  image: { asset: ImageAsset; widthMm: number; heightMm: number } | null;
}

export type ResolvedBand = Record<SlotPosition, ResolvedSlot>;

export interface PageDecor {
  margins: PageMargins;
  header: ResolvedBand;
  footer: ResolvedBand;
  pageNumber: PageNumberPosition;
}

function resolveBand(
  band: PageBand,
  marginMm: number,
  assets: AssetMap,
  data: JsonObject,
  engine: TemplateEngine,
): ResolvedBand {
  const result = {} as ResolvedBand;
  for (const position of SLOT_POSITIONS) {
    const slot = band[position];
    const text = engine.renderPlainText(slot.text, data).replace(/\s+/g, " ").trim();
    const asset = slot.imageId && hasAsset(assets, slot.imageId) ? assets[slot.imageId] : null;

    // The image must fit in the margin; 2 mm of clearance remain.
    const maxHeight = Math.max(IMAGE_HEIGHT_LIMITS.min, marginMm - 2);
    const heightMm = Math.min(Math.max(slot.imageHeightMm, IMAGE_HEIGHT_LIMITS.min), maxHeight);
    const image = asset ? { asset, heightMm, widthMm: (heightMm * asset.width) / asset.height } : null;

    result[position] = { text, image };
  }
  return result;
}

export function resolvePageDecor(
  settings: DocumentSettings,
  assets: AssetMap,
  data: JsonObject,
  engine: TemplateEngine = defaultEngine,
): PageDecor {
  return {
    margins: settings.margins,
    header: resolveBand(settings.header, settings.margins.top, assets, data, engine),
    footer: resolveBand(settings.footer, settings.margins.bottom, assets, data, engine),
    pageNumber: settings.pageNumber,
  };
}

function numberSlot(position: PageNumberPosition): SlotPosition | null {
  if (position === "bottom-right") return "right";
  if (position === "bottom-center") return "center";
  return null;
}

// ---------------------------------------------------------------------------
// PDF: CSS page margin boxes
// ---------------------------------------------------------------------------

const BOX_STYLE = "font: 8pt/1.3 Arial, 'Liberation Sans', Helvetica, sans-serif; color: #4b5563;";
const HEADER_BOXES: Record<SlotPosition, string> = { left: "top-left", center: "top-center", right: "top-right" };
const FOOTER_BOXES: Record<SlotPosition, string> = { left: "bottom-left", center: "bottom-center", right: "bottom-right" };

// "<" is escaped so text can never form a "</style>" and break out of the style block.
function cssString(text: string): string {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")
    .replace(/</g, "\\3c ");
  return `"${escaped}"`;
}

function boxContent(slot: ResolvedSlot, withPageNumber: boolean): string | null {
  const parts: string[] = [];
  if (slot.image) parts.push(`url("${sizedImageUri(slot.image.asset, slot.image.widthMm, slot.image.heightMm)}")`);
  if (slot.text) parts.push(cssString(slot.image ? ` ${slot.text}` : slot.text));
  if (withPageNumber) {
    if (parts.length > 0) parts.push('" "');
    parts.push('counter(page) "/" counter(pages)');
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

// Comes after document.css and overrides its @page margins (the later @page rule wins).
export function pageDecorToCss(decor: PageDecor): string {
  const { top, right, bottom, left } = decor.margins;
  const rules: string[] = [];

  const collect = (band: ResolvedBand, boxes: Record<SlotPosition, string>, withNumber: SlotPosition | null) => {
    for (const position of SLOT_POSITIONS) {
      const content = boxContent(band[position], withNumber === position);
      if (content) rules.push(`  @${boxes[position]} { content: ${content}; ${BOX_STYLE} }`);
    }
  };
  collect(decor.header, HEADER_BOXES, null);
  collect(decor.footer, FOOTER_BOXES, numberSlot(decor.pageNumber));

  return `@page {\n  margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;\n${rules.join("\n")}\n}`;
}

// ---------------------------------------------------------------------------
// Preview: markup for the sheet margins (paginate.ts sets the page number per sheet)
// ---------------------------------------------------------------------------

function slotHtml(slot: ResolvedSlot, position: SlotPosition, withPageNumber: boolean): string {
  let html = "";
  if (slot.image) {
    const { asset, widthMm, heightMm } = slot.image;
    html += `<img src="${asset.dataUri}" alt="" style="width:${widthMm.toFixed(2)}mm;height:${heightMm.toFixed(2)}mm">`;
  }
  if (slot.text) html += escapeHtml(slot.image ? ` ${slot.text}` : slot.text);
  if (withPageNumber) html += `${html ? " " : ""}<span class="page-number">1/1</span>`;
  return `<div class="slot slot-${position}">${html}</div>`;
}

export function pageDecorToHtml(decor: PageDecor): string {
  const band = (resolved: ResolvedBand, className: string, withNumber: SlotPosition | null) =>
    `<div class="sheet-band ${className}">${SLOT_POSITIONS.map((position) =>
      slotHtml(resolved[position], position, withNumber === position),
    ).join("")}</div>`;

  return band(decor.header, "sheet-header", null) + band(decor.footer, "sheet-footer", numberSlot(decor.pageNumber));
}

export function marginVariablesCss(margins: PageMargins): string {
  return `:root{--page-margin-top:${margins.top}mm;--page-margin-right:${margins.right}mm;--page-margin-bottom:${margins.bottom}mm;--page-margin-left:${margins.left}mm}`;
}

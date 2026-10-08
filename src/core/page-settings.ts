// Page layout of a document: margins, header/footer and page number.

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type PageNumberPosition = "none" | "bottom-right" | "bottom-center";

export interface PageSlot {
  // Text with Handlebars placeholders (single line), e.g. "{{company.name}}".
  text: string;
  // ID of an image from the document's image list.
  imageId: string | null;
  imageHeightMm: number;
}

export interface PageBand {
  left: PageSlot;
  center: PageSlot;
  right: PageSlot;
}

export type SlotPosition = keyof PageBand;
export const SLOT_POSITIONS: SlotPosition[] = ["left", "center", "right"];

export interface DocumentSettings {
  margins: PageMargins;
  header: PageBand;
  footer: PageBand;
  pageNumber: PageNumberPosition;
}

export const MARGIN_LIMITS = { min: 0, max: 60 } as const;
export const IMAGE_HEIGHT_LIMITS = { min: 2, max: 40 } as const;
const MAX_SLOT_TEXT = 300;

export const DEFAULT_MARGINS: PageMargins = { top: 20, right: 15, bottom: 20, left: 15 };

export function emptySlot(): PageSlot {
  return { text: "", imageId: null, imageHeightMm: 10 };
}

export function emptySettings(): DocumentSettings {
  return {
    margins: { ...DEFAULT_MARGINS },
    header: { left: emptySlot(), center: emptySlot(), right: emptySlot() },
    footer: { left: emptySlot(), center: emptySlot(), right: emptySlot() },
    pageNumber: "none",
  };
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function parseSlot(value: unknown, fallback: PageSlot): PageSlot {
  if (typeof value !== "object" || value === null) return fallback;
  const { text, imageId, imageHeightMm } = value as Record<string, unknown>;
  return {
    text: typeof text === "string" ? text.slice(0, MAX_SLOT_TEXT) : fallback.text,
    imageId: typeof imageId === "string" && imageId ? imageId : null,
    imageHeightMm: clampNumber(imageHeightMm, IMAGE_HEIGHT_LIMITS.min, IMAGE_HEIGHT_LIMITS.max, fallback.imageHeightMm),
  };
}

function parseBand(value: unknown, fallback: PageBand): PageBand {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    left: parseSlot(source.left, fallback.left),
    center: parseSlot(source.center, fallback.center),
    right: parseSlot(source.right, fallback.right),
  };
}

// Validates untrusted input (localStorage, request body); missing or invalid fields come from `fallback`.
export function parseSettings(value: unknown, fallback: DocumentSettings): DocumentSettings {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const margins = typeof source.margins === "object" && source.margins !== null ? (source.margins as Record<string, unknown>) : {};
  const pageNumber = source.pageNumber;

  return {
    margins: {
      top: clampNumber(margins.top, MARGIN_LIMITS.min, MARGIN_LIMITS.max, fallback.margins.top),
      right: clampNumber(margins.right, MARGIN_LIMITS.min, MARGIN_LIMITS.max, fallback.margins.right),
      bottom: clampNumber(margins.bottom, MARGIN_LIMITS.min, MARGIN_LIMITS.max, fallback.margins.bottom),
      left: clampNumber(margins.left, MARGIN_LIMITS.min, MARGIN_LIMITS.max, fallback.margins.left),
    },
    header: parseBand(source.header, fallback.header),
    footer: parseBand(source.footer, fallback.footer),
    pageNumber:
      pageNumber === "none" || pageNumber === "bottom-right" || pageNumber === "bottom-center"
        ? pageNumber
        : fallback.pageNumber,
  };
}

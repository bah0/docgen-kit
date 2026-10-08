// Images of a document. The template only contains <img src="asset:ID">; the data is stored separately
// in the image list and inserted as a data URI only at render time. This keeps the template
// readable, and Gotenberg still receives a single, self-contained HTML.

export type ImageMime = "image/png" | "image/jpeg" | "image/svg+xml";

export interface ImageAsset {
  id: string;
  name: string;
  mime: ImageMime;
  dataUri: string;
  // Natural size in px (only used for the aspect ratio).
  width: number;
  height: number;
}

export type AssetMap = Record<string, ImageAsset>;

export const ASSET_SCHEME = "asset:";
export const MAX_ASSET_DATA_URI_CHARS = 2_000_000;

const ASSET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const DATA_URI = /^data:(image\/png|image\/jpeg|image\/svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;
const ASSET_SRC = /\ssrc=(["'])asset:([A-Za-z0-9_-]{1,40})\1/g;

// Gray placeholder image for deleted or unknown images.
const MISSING_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#e5e7eb"/></svg>',
)}`;

export function isAssetId(value: string): boolean {
  return ASSET_ID.test(value);
}

export function hasAsset(assets: AssetMap, id: string): boolean {
  return Object.hasOwn(assets, id);
}

function positive(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 100;
}

// Validates untrusted input (localStorage, request body). Only valid Base64 data URIs with PNG/JPEG/SVG remain.
export function parseAssets(value: unknown): AssetMap {
  const result: AssetMap = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return result;

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "object" || entry === null || !isAssetId(key)) continue;
    const { id, name, dataUri, width, height } = entry as Record<string, unknown>;
    if (id !== key || typeof dataUri !== "string" || dataUri.length > MAX_ASSET_DATA_URI_CHARS) continue;
    if (!DATA_URI.test(dataUri)) continue;

    result[key] = {
      id: key,
      name: typeof name === "string" ? name.slice(0, 120) : key,
      mime: dataUri.slice(5, dataUri.indexOf(";")) as ImageMime,
      dataUri,
      width: positive(width),
      height: positive(height),
    };
  }
  return result;
}

// Replaces src="asset:ID" with the image's data URI.
export function resolveAssetUrls(html: string, assets: AssetMap): string {
  return html.replace(ASSET_SRC, (_match, quote: string, id: string) => {
    const uri = hasAsset(assets, id) ? assets[id].dataUri : MISSING_IMAGE;
    return ` src=${quote}${uri}${quote}`;
  });
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

// SVG wrapper with a fixed size in mm. `content: url()` in page margin boxes has no width/height;
// the size comes from the wrapper, the actual image (PNG, JPG or SVG) is embedded inside.
export function sizedImageUri(asset: ImageAsset, widthMm: number, heightMm: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(2)}mm" height="${heightMm.toFixed(2)}mm" ` +
    `viewBox="0 0 ${asset.width} ${asset.height}">` +
    `<image href="${asset.dataUri}" width="${asset.width}" height="${asset.height}"/></svg>`;
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

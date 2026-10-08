import {
  MAX_ASSET_DATA_URI_CHARS,
  utf8ToBase64,
  type ImageAsset,
  type ImageMime,
} from "../core/assets";

// Processes uploaded files (browser only): PNG/JPG are downscaled, SVG is sanitised.
// The result is an ImageAsset with a Base64 data URI.

export const IMAGE_ACCEPT = ".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
// Longest side in px; reduced step by step if the file is too large.
const RASTER_MAX_SIDES = [1600, 1200, 800, 500];

function detectMime(file: File): ImageMime | null {
  const name = file.name.toLowerCase();
  if (file.type === "image/png" || name.endsWith(".png")) return "image/png";
  if (file.type === "image/jpeg" || /\.jpe?g$/.test(name)) return "image/jpeg";
  if (file.type === "image/svg+xml" || name.endsWith(".svg")) return "image/svg+xml";
  return null;
}

function newAssetId(): string {
  return `img-${crypto.randomUUID().slice(0, 8)}`;
}

async function processRaster(file: File, mime: "image/png" | "image/jpeg") {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The file is not a readable image.");
  }

  try {
    for (const maxSide of RASTER_MAX_SIDES) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("The image could not be processed.");
      if (mime === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(bitmap, 0, 0, width, height);

      const dataUri = canvas.toDataURL(mime, 0.85);
      if (dataUri.length <= MAX_ASSET_DATA_URI_CHARS) return { dataUri, width, height };
    }
  } finally {
    bitmap.close();
  }
  throw new Error("The image is still too large, even when downscaled.");
}

// SVG is only embedded as <img> (no scripts run there). Scripts, foreignObject,
// event handlers and external references are removed anyway.
function sanitizeSvg(root: Element): void {
  root.querySelectorAll("script, foreignObject").forEach((element) => element.remove());
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const isLink = name === "href" || name === "xlink:href";
      const safeLink = attribute.value.startsWith("#") || attribute.value.startsWith("data:image/");
      if (name.startsWith("on") || (isLink && !safeLink)) element.removeAttribute(attribute.name);
    }
  }
}

function svgSize(root: Element): { width: number; height: number } {
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }
  const width = parseFloat(root.getAttribute("width") ?? "");
  const height = parseFloat(root.getAttribute("height") ?? "");
  return width > 0 && height > 0 ? { width, height } : { width: 100, height: 100 };
}

async function processSvg(file: File) {
  const parsed = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const root = parsed.documentElement;
  if (parsed.querySelector("parsererror") || root.localName !== "svg") {
    throw new Error("The file is not a valid SVG.");
  }
  sanitizeSvg(root);

  const dataUri = `data:image/svg+xml;base64,${utf8ToBase64(new XMLSerializer().serializeToString(root))}`;
  if (dataUri.length > MAX_ASSET_DATA_URI_CHARS) throw new Error("The SVG file is too large.");
  return { dataUri, ...svgSize(root) };
}

export async function createImageAsset(file: File): Promise<ImageAsset> {
  const mime = detectMime(file);
  if (!mime) throw new Error("Only SVG, PNG and JPG are allowed.");
  if (file.size > MAX_FILE_BYTES) throw new Error("The file is larger than 8 MB.");

  const processed = mime === "image/svg+xml" ? await processSvg(file) : await processRaster(file, mime);
  return { id: newAssetId(), name: file.name.slice(0, 120), mime, ...processed };
}

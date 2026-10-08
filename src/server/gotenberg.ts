import { PdfRenderError, type PdfRenderer } from "./pdf-renderer";

// Gotenberg adapter: sends the HTML as multipart/form-data to the Chromium route and returns the PDF.

export const DEFAULT_GOTENBERG_URL = "http://localhost:3011";

export interface GotenbergOptions {
  // Base URL of the Gotenberg container. Default: http://localhost:3011
  url?: string;
  // Abort the request after this many milliseconds. Default: 30000
  timeoutMs?: number;
  // Custom fetch implementation (tests, proxies, instrumentation).
  fetch?: typeof fetch;
}

export function createGotenbergRenderer({
  url = DEFAULT_GOTENBERG_URL,
  timeoutMs = 30_000,
  fetch: fetchImpl = fetch,
}: GotenbergOptions = {}): PdfRenderer {
  const baseUrl = url.replace(/\/+$/, "");

  return {
    async render(html) {
      const form = new FormData();
      // Gotenberg expects the main file under exactly the name "index.html".
      form.append("files", new Blob([html], { type: "text/html" }), "index.html");
      // @page { size: A4; margin: ... } from the stylesheet applies, not the Gotenberg defaults.
      form.append("preferCssPageSize", "true");
      form.append("printBackground", "true");
      form.append("emulatedMediaType", "print");

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/forms/chromium/convert/html`, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new PdfRenderError("Gotenberg did not respond in time.", 504);
        }
        throw new PdfRenderError(`Gotenberg is not reachable at ${baseUrl}. Is "docker compose up -d" running?`, 503);
      }

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 500);
        throw new PdfRenderError(`Gotenberg responded with ${response.status}${detail ? `: ${detail}` : ""}`, 502);
      }

      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

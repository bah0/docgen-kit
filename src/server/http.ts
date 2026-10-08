import { PdfRenderError } from "./pdf-renderer";
import type { PdfService } from "./service";

export interface RequestHandlerOptions {
  // Maximum request body size in characters (images are inlined as Base64). Default: 12,000,000
  maxBodyChars?: number;
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

// Web-standard handler `(Request) => Response`: usable as a Next.js route handler, in Hono, Bun,
// Deno, Cloudflare Workers, or behind any Node adapter that speaks the Fetch API.
//
//   export const POST = createPdfRequestHandler(service);
//
// Expects a JSON body `{ template, data, title?, kind?, settings?, assets?, fields? }` and answers with the PDF.
export function createPdfRequestHandler(service: PdfService, { maxBodyChars = 12_000_000 }: RequestHandlerOptions = {}) {
  return async function handler(request: Request): Promise<Response> {
    // Require JSON: cross-site forms cannot send this content type without a CORS preflight.
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return errorResponse("Content-Type must be application/json.", 415);
    }

    const raw = await request.text();
    if (raw.length > maxBodyChars) return errorResponse("The request is too large.", 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("The request body is not valid JSON.", 400);
    }

    try {
      const { pdf, filename } = await service.generate(service.parse(body));
      const ascii = filename
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7e]/g, "_");
      return new Response(pdf as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      if (error instanceof PdfRenderError) return errorResponse(error.message, error.status);
      throw error;
    }
  };
}

import type { DocumentInput } from "../core/render";

// Requests a PDF from a server route created with `createPdfRequestHandler` (docgen-kit/server).

export interface FetchPdfOptions {
  signal?: AbortSignal;
  // Custom fetch implementation (tests, auth headers, ...).
  fetch?: typeof fetch;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // The response was not JSON.
  }
  return `The PDF route responded with status ${response.status}.`;
}

// Posts the document as JSON and resolves with the PDF. Rejects with an Error carrying the server's
// message; an aborted request rejects with the original AbortError.
export async function fetchPdf(endpoint: string, input: DocumentInput, options: FetchPdfOptions = {}): Promise<Blob> {
  const { signal, fetch: fetchImpl = fetch } = options;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.blob();
}

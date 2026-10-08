// Contract between the PDF service and the engine that turns HTML into a PDF.
export interface PdfRenderer {
  // Converts a complete HTML document (single file, assets inlined) into PDF bytes.
  render(html: string): Promise<Uint8Array>;
}

// Error with an HTTP-like status so web adapters can map it to a response.
export class PdfRenderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfRenderError";
  }
}

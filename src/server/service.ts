import { parseDocumentInput } from "../core/parse-input";
import { renderDocument, type DocumentInput } from "../core/render";
import { defaultEngine, type TemplateEngine } from "../core/handlebars";
import { PdfRenderError, type PdfRenderer } from "./pdf-renderer";

export interface PdfServiceOptions {
  // Turns the final HTML into a PDF, e.g. `createGotenbergRenderer()`.
  renderer: PdfRenderer;
  // Template engine (locale, currency, custom helpers). Default: `defaultEngine`.
  engine?: TemplateEngine;
  // Stylesheet; defaults to the built-in `documentCss`.
  css?: string;
  // Value of the `lang` attribute of the generated HTML. Default: "en".
  language?: string;
  // Add fillable AcroForm fields for form-field placeholders (needs the optional `pdf-lib` dependency). Default: true
  acroForm?: boolean;
}

export interface GeneratedPdf {
  pdf: Uint8Array;
  // Safe file name derived from the title, e.g. "Invoice.pdf".
  filename: string;
}

export interface PdfService {
  // Validates untrusted input (e.g. a request body); throws PdfRenderError with status 400.
  parse(value: unknown): DocumentInput;
  // Renders the HTML that would be sent to the PDF engine; throws PdfRenderError with status 422 on template errors.
  renderHtml(input: DocumentInput): string;
  generate(input: DocumentInput): Promise<GeneratedPdf>;
}

// Makes a title safe to use as a file name (letters, numbers, `._ -`), capped at 80 characters.
export function toFilename(title: string | undefined): string {
  const cleaned =
    (title ?? "").replace(/[^\p{L}\p{N}._ -]+/gu, "").trim().slice(0, 80) || "document";
  return `${cleaned}.pdf`;
}

export function createPdfService({
  renderer,
  engine = defaultEngine,
  css,
  language,
  acroForm = true,
}: PdfServiceOptions): PdfService {
  const renderHtml = (input: DocumentInput): string => {
    const result = renderDocument(input, { target: "pdf", css, engine, language });
    if (!result.ok) throw new PdfRenderError(`Template error: ${result.error}`, 422);
    return result.html;
  };

  return {
    parse(value) {
      const parsed = parseDocumentInput(value);
      if (!parsed.ok) throw new PdfRenderError(parsed.error, 400);
      return parsed.value;
    },

    renderHtml,

    async generate(input) {
      const html = renderHtml(input);
      const original = await renderer.render(html);
      const filename = toFilename(input.title);

      const fields = input.fields ?? {};
      if (!acroForm || Object.keys(fields).length === 0) return { pdf: original, filename };

      let applyAcroForm: typeof import("./acroform").applyAcroForm;
      try {
        ({ applyAcroForm } = await import("./acroform"));
      } catch {
        throw new PdfRenderError('Form fields need the optional dependency "pdf-lib" (npm install pdf-lib).', 500);
      }

      try {
        // Without field links in the PDF (fields not used in the template) the PDF stays unchanged.
        const withFields = await applyAcroForm(original, fields, input.data, engine);
        return { pdf: withFields ?? original, filename };
      } catch (error) {
        throw new PdfRenderError(
          `Form fields could not be created: ${error instanceof Error ? error.message : String(error)}`,
          500,
        );
      }
    },
  };
}

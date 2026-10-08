import { PDFArray, PDFDocument, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { createFormField, type FieldMap } from "../src/core";
import { createPdfRequestHandler, createPdfService, PdfRenderError, toFilename, type PdfRenderer } from "../src/server";

const LINK = "https://acroform.invalid/";

// A fake PDF engine: returns a one-page PDF with link annotations at fixed positions, just like
// Chromium does for the field boxes (<a href="https://acroform.invalid/ID/option/occurrence">).
function fakeRenderer(links: { href: string; rect: [number, number, number, number] }[]): PdfRenderer & { html: string[] } {
  const html: string[] = [];
  return {
    html,
    async render(input) {
      html.push(input);
      const doc = await PDFDocument.create();
      const page = doc.addPage([595, 842]);
      for (const { href, rect } of links) {
        const annotation = doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: rect,
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(href) },
        });
        page.node.addAnnot(doc.context.register(annotation));
      }
      return doc.save();
    },
  };
}

const textField = { ...createFormField("text", {}), id: "ff-text0001", name: "full_name", defaultValue: "{{customer}}" };
const checkbox = { ...createFormField("checkbox", {}), id: "ff-check001", name: "accept", defaultValue: "true" };
const fields: FieldMap = { [textField.id]: textField, [checkbox.id]: checkbox };

const marker = (id: string) => `<span data-form-field="${id}"></span>`;
const body = {
  template: `<p>${marker("ff-text0001")} ${marker("ff-check001")}</p>`,
  data: { customer: "Jane Roe" },
  title: "Application",
  fields,
};

describe("createPdfService", () => {
  const renderer = fakeRenderer([
    { href: `${LINK}ff-text0001/0/1`, rect: [100, 700, 270, 723] },
    { href: `${LINK}ff-check001/0/1`, rect: [300, 700, 314, 714] },
    { href: "https://example.com/real-link", rect: [10, 10, 50, 20] },
  ]);
  const service = createPdfService({ renderer });

  it("turns field links into fillable AcroForm fields and keeps ordinary links", async () => {
    const { pdf, filename } = await service.generate(service.parse(body));
    expect(filename).toBe("Application.pdf");

    const doc = await PDFDocument.load(pdf);
    const form = doc.getForm();
    expect(form.getFields().map((entry) => entry.getName()).sort()).toEqual(["accept", "full_name"]);
    expect(form.getTextField("full_name").getText()).toBe("Jane Roe");
    expect(form.getCheckBox("accept").isChecked()).toBe(true);

    // The widget sits on the link's rectangle (pdf-lib grows it slightly by the border width).
    const rect = form.getTextField("full_name").acroField.getWidgets()[0].getRectangle();
    for (const [actual, expected] of [[rect.x, 100], [rect.y, 700], [rect.width, 170], [rect.height, 23]]) {
      expect(Math.abs(actual - expected)).toBeLessThan(1);
    }

    // Only the unrelated link remains as an annotation besides the two widgets.
    const annots = doc.getPages()[0].node.Annots() as PDFArray;
    expect(annots.size()).toBe(3);
    expect(renderer.html[0]).toContain("https://acroform.invalid/ff-text0001/0/1");
  });

  it("returns the original PDF when no fields are defined", async () => {
    const { pdf } = await service.generate(service.parse({ ...body, fields: {} }));
    const doc = await PDFDocument.load(pdf);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("maps invalid input and template errors to PdfRenderError", async () => {
    expect(() => service.parse({ template: 1 })).toThrowError(PdfRenderError);
    await expect(service.generate({ template: "{{#if}}", data: {} })).rejects.toMatchObject({ status: 422 });
  });
});

describe("toFilename", () => {
  it("keeps letters and digits and falls back to a default", () => {
    expect(toFilename("Invoice 2026/10: <draft>")).toBe("Invoice 202610 draft.pdf");
    expect(toFilename("   ")).toBe("document.pdf");
    expect(toFilename(undefined)).toBe("document.pdf");
  });
});

describe("createPdfRequestHandler", () => {
  const service = createPdfService({ renderer: fakeRenderer([]) });
  const handler = createPdfRequestHandler(service, { maxBodyChars: 5_000 });
  const post = (payload: BodyInit, contentType = "application/json") =>
    handler(new Request("http://localhost/api/pdf", { method: "POST", headers: { "Content-Type": contentType }, body: payload }));

  it("answers with the PDF and a safe Content-Disposition", async () => {
    const response = await post(JSON.stringify({ template: "<p>x</p>", data: {}, title: "Überweisung" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('filename="Uberweisung.pdf"');
    expect(response.headers.get("Content-Disposition")).toContain("filename*=UTF-8''%C3%9Cberweisung.pdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("rejects wrong content types, oversized and malformed bodies", async () => {
    expect((await post("{}", "text/plain")).status).toBe(415);
    expect((await post("x".repeat(6_000))).status).toBe(413);
    expect((await post("{not json")).status).toBe(400);
    expect((await post(JSON.stringify({ template: 5 }))).status).toBe(400);
  });

  it("reports template errors as 422 JSON", async () => {
    const response = await post(JSON.stringify({ template: "{{#if}}", data: {} }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Template error") });
  });
});

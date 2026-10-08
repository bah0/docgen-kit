import { describe, expect, it } from "vitest";

import { emptySettings, renderDocument, type DocumentInput } from "../src/core";

const input: DocumentInput = {
  template: "<h1>Invoice {{no}}</h1>",
  data: { no: "INV-1", company: "Acme & Sons" },
  title: "Invoice <1>",
  kind: "invoice",
};

describe("renderDocument", () => {
  it("builds a complete HTML document for the PDF", () => {
    const result = renderDocument(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe("<h1>Invoice INV-1</h1>");
    expect(result.html).toContain('<html lang="en">');
    expect(result.html).toContain("<title>Invoice &lt;1&gt;</title>");
    expect(result.html).toContain('<body class="is-pdf">');
    expect(result.html).toContain('<main class="document document--invoice"><h1>Invoice INV-1</h1></main>');
    // Page margins are emitted as @page rules in the same HTML.
    expect(result.html).toContain("@page {");
  });

  it("renders header and footer text into the @page margin boxes", () => {
    const settings = emptySettings();
    settings.footer.left.text = "{{company}} page";
    settings.pageNumber = "bottom-right";
    const result = renderDocument({ ...input, settings });
    // Header/footer text lands in a CSS string, so it is not HTML-escaped.
    expect(result.ok && result.html).toContain('content: "Acme & Sons page"');
    expect(result.ok && result.html).toContain("counter(page)");
  });

  it("uses a template element and CSS variables for the preview target", () => {
    const result = renderDocument(input, { target: "preview" });
    expect(result.ok && result.html).toContain('<body class="is-preview">');
    expect(result.ok && result.html).toContain('<template id="page-decor">');
  });

  it("supports a custom stylesheet and language", () => {
    const result = renderDocument(input, { css: "body{color:red}", language: "de" });
    expect(result.ok && result.html).toContain("<style>body{color:red}</style>");
    expect(result.ok && result.html).toContain('<html lang="de">');
  });

  it("replaces asset references with data URIs", () => {
    const dataUri = "data:image/png;base64,AAAA";
    const result = renderDocument({
      ...input,
      template: '<img src="asset:img-1" style="width: 20mm">',
      assets: { "img-1": { id: "img-1", name: "logo.png", mime: "image/png", dataUri, width: 10, height: 10 } },
    });
    expect(result.ok && result.html).toContain(`src="${dataUri}"`);
  });

  it("returns the template error instead of throwing", () => {
    const result = renderDocument({ ...input, template: "{{#if}}" });
    expect(result.ok).toBe(false);
  });
});

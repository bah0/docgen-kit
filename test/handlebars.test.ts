import { describe, expect, it } from "vitest";

import { createTemplateEngine, extractVariablePaths, renderTemplate } from "../src/core";

describe("template engine helpers", () => {
  it("formats money, numbers and dates with the default locale (en-GB, GBP)", () => {
    const result = renderTemplate(
      "{{money amount}} | {{number ratio 1}} | {{date day}}",
      { amount: 1234.5, ratio: 7.25, day: "2026-10-08" },
    );
    expect(result).toEqual({ ok: true, html: "£1,234.50 | 7.3 | 8 Oct 2026" });
  });

  it("supports a different locale and currency", () => {
    const engine = createTemplateEngine({ locale: "de-DE", currency: "EUR" });
    const result = engine.render("{{money amount}} | {{date day}}", { amount: 1234.5, day: "2026-10-08" });
    expect(result.ok && result.html.replace(/\s/g, " ")).toBe("1.234,50 € | 8. Okt. 2026");
  });

  it("calculates sums over arrays", () => {
    const data = { items: [{ qty: 2, price: 10 }, { qty: 3, price: 5 }] };
    const result = renderTemplate('{{sum items "qty"}} / {{sumProduct items "qty" "price"}}', data);
    expect(result).toEqual({ ok: true, html: "5 / 35" });
  });

  it("allows custom helpers", () => {
    const engine = createTemplateEngine({ helpers: { shout: (value: unknown) => String(value).toUpperCase() } });
    expect(engine.render("{{shout name}}", { name: "acme" })).toEqual({ ok: true, html: "ACME" });
  });

  it("escapes HTML in values but not in plain text", () => {
    const engine = createTemplateEngine();
    expect(engine.render("{{value}}", { value: "<b>" })).toEqual({ ok: true, html: "&lt;b&gt;" });
    expect(engine.renderPlainText("{{value}}", { value: "<b>" })).toBe("<b>");
  });

  it("reports syntax errors instead of throwing", () => {
    const result = renderTemplate("{{#each items}}", { items: [] });
    expect(result.ok).toBe(false);
  });
});

describe("extractVariablePaths", () => {
  it("lists variables and loops derived from the JSON", () => {
    const { variables, loops } = extractVariablePaths({
      customer: { name: "Jane" },
      items: [{ title: "A", qty: 1 }],
    });
    expect(variables.map((variable) => variable.expression)).toEqual(["{{customer.name}}"]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatchObject({ path: "items", itemFields: ["title", "qty"], length: 1 });
    expect(loops[0].lines[0]).toBe("{{#each items}}");
  });
});

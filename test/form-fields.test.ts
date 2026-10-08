import { describe, expect, it } from "vitest";

import {
  createFormField,
  listUsedFieldIds,
  parseFormFields,
  removeFieldFromTemplate,
  resolveFormFields,
  type FieldMap,
} from "../src/core";

const field = (type: Parameters<typeof createFormField>[0], id: string, name: string): FieldMap[string] => ({
  ...createFormField(type, {}),
  id,
  name,
});

const marker = (id: string) => `<span data-form-field="${id}"></span>`;

describe("form fields", () => {
  const fields: FieldMap = {
    "ff-text0001": field("text", "ff-text0001", "full_name"),
    "ff-radio001": { ...field("radio", "ff-radio001", "plan"), options: ["Basic", "Premium"] },
  };

  it("renders placeholder boxes for the preview", () => {
    const html = resolveFormFields(marker("ff-text0001"), fields, "preview");
    expect(html).toContain('class="ff ff-text"');
    expect(html).not.toContain("acroform.invalid");
  });

  it("renders link boxes with id, option and occurrence for the PDF", () => {
    const html = resolveFormFields(`${marker("ff-text0001")} ${marker("ff-text0001")} ${marker("ff-radio001")}`, fields, "pdf");
    expect(html).toContain('href="https://acroform.invalid/ff-text0001/0/1"');
    expect(html).toContain('href="https://acroform.invalid/ff-text0001/0/2"');
    expect(html).toContain('href="https://acroform.invalid/ff-radio001/0/1"');
    expect(html).toContain('href="https://acroform.invalid/ff-radio001/1/1"');
  });

  it("drops placeholders of unknown fields", () => {
    expect(resolveFormFields(`a${marker("ff-gone0001")}b`, fields, "pdf")).toBe("ab");
  });

  it("finds and removes placeholders in a template", () => {
    const template = `${marker("ff-text0001")}<p>${marker("ff-radio001")}${marker("ff-text0001")}</p>`;
    expect(listUsedFieldIds(template)).toEqual(["ff-text0001", "ff-radio001"]);
    expect(removeFieldFromTemplate(template, "ff-text0001")).toBe(`<p>${marker("ff-radio001")}</p>`);
  });

  it("creates unique default names per type", () => {
    const first = createFormField("checkbox", {});
    const second = createFormField("checkbox", { [first.id]: first });
    expect(first.name).toBe("checkbox_1");
    expect(second.name).toBe("checkbox_2");
  });

  it("validates untrusted field definitions", () => {
    const parsed = parseFormFields({
      "ff-ok000001": { ...fields["ff-text0001"], id: "ff-ok000001", name: "a.b", widthMm: 9999 },
      "ff-bad": { id: "other", type: "text" },
      "ff-type001": { id: "ff-type001", type: "unknown" },
      "../evil": { id: "../evil", type: "text" },
    });
    expect(Object.keys(parsed)).toEqual(["ff-ok000001"]);
    // Dots are not allowed in names; sizes are clamped.
    expect(parsed["ff-ok000001"].name).toBe("a_b");
    expect(parsed["ff-ok000001"].widthMm).toBe(200);
  });
});

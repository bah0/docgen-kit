import { escapeHtml } from "./escape-html";
import { clampNumber } from "./page-settings";

// Fillable form fields (AcroForm). The template only contains a placeholder
// <span data-form-field="ID"></span>; the definition lives in the document's field list.
//
// Position and size are determined by the browser: each field is placed in the text as a box with a fixed size and, in the PDF HTML, wrapped
// in a link <a href="https://acroform.invalid/ID/Option/Occurrence">.
// Chromium writes a link annotation with the exact rectangle into the PDF; lib/acroform.ts
// then replaces it with the real form field via pdf-lib. Gotenberg only sees plain HTML.

export type FormFieldType =
  | "text"
  | "textarea"
  | "date"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "listbox"
  | "signature"
  | "button";

export type ButtonAction = "reset" | "print";
export type FieldAlign = "left" | "center" | "right";

export interface FormFieldDef {
  id: string;
  type: FormFieldType;
  // Field name in the PDF (unique, no dots).
  name: string;
  // Visible text: checkbox label, signature label, button text.
  label: string;
  tooltip: string;
  required: boolean;
  readOnly: boolean;
  widthMm: number;
  heightMm: number;
  // Width 100 % instead of widthMm (text, select and list fields).
  fullWidth: boolean;
  // Default value; may contain Handlebars (e.g. "{{customer.name}}"). Checkbox: "true"/"false".
  defaultValue: string;
  maxLength: number;
  // 0 = automatic, otherwise fixed font size in pt.
  fontSizePt: number;
  align: FieldAlign;
  options: string[];
  // Option group: options stacked instead of side by side.
  vertical: boolean;
  multiSelect: boolean;
  action: ButtonAction;
}

export type FieldMap = Record<string, FormFieldDef>;

export const FIELD_ATTRIBUTE = "data-form-field";
export const FIELD_LINK_BASE = "https://acroform.invalid/";

export const SIZE_LIMITS = { min: 2, max: 200 } as const;
const FIELD_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_FIELDS = 500;
const MAX_OPTIONS = 60;

export interface FieldTypeInfo {
  label: string;
  description: string;
  defaults: Partial<FormFieldDef>;
}

export const FIELD_TYPES: Record<FormFieldType, FieldTypeInfo> = {
  text: {
    label: "Text field",
    description: "Single-line input",
    defaults: { widthMm: 60, heightMm: 8 },
  },
  textarea: {
    label: "Multi-line text field",
    description: "Free text with line breaks and a scroll bar",
    defaults: { widthMm: 120, heightMm: 24 },
  },
  date: {
    label: "Date field",
    description: "Text field with the date format YYYY-MM-DD",
    defaults: { widthMm: 30, heightMm: 8, maxLength: 10 },
  },
  checkbox: {
    label: "Checkbox",
    description: "Yes/no with a label",
    defaults: { widthMm: 4.5, heightMm: 4.5, label: "Option" },
  },
  radio: {
    label: "Radio group",
    description: "Radio buttons, exactly one option selectable",
    defaults: { widthMm: 4.5, heightMm: 4.5, options: ["Option 1", "Option 2"] },
  },
  dropdown: {
    label: "Dropdown",
    description: "Selection list that opens on click",
    defaults: { widthMm: 50, heightMm: 8, options: ["Option 1", "Option 2", "Option 3"] },
  },
  listbox: {
    label: "List box",
    description: "Visible list, optionally with multi-select",
    defaults: { widthMm: 50, heightMm: 24, options: ["Option 1", "Option 2", "Option 3"] },
  },
  signature: {
    label: "Signature",
    description: "Signature field with a signature line",
    defaults: { widthMm: 70, heightMm: 22, label: "Signature" },
  },
  button: {
    label: "Button",
    description: "Reset the form or print",
    defaults: { widthMm: 35, heightMm: 9, label: "Reset" },
  },
};

export const FIELD_TYPE_ORDER: FormFieldType[] = [
  "text",
  "textarea",
  "date",
  "checkbox",
  "radio",
  "dropdown",
  "listbox",
  "signature",
  "button",
];

export function isFieldId(value: string): boolean {
  return FIELD_ID.test(value);
}

export function newFieldId(): string {
  return `ff-${crypto.randomUUID().slice(0, 8)}`;
}

export function sanitizeFieldName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[^\p{L}\p{N} _-]+/gu, "_")
    .trim()
    .slice(0, 60);
  return cleaned || fallback;
}

// Creates a new field with default values; the name is unique among the existing ones.
export function createFormField(type: FormFieldType, existing: FieldMap): FormFieldDef {
  const id = newFieldId();
  const base = type;
  const names = new Set(Object.values(existing).map((field) => field.name));
  let index = 1;
  while (names.has(`${base}_${index}`)) index += 1;

  return {
    id,
    type,
    name: `${base}_${index}`,
    label: "",
    tooltip: "",
    required: false,
    readOnly: false,
    widthMm: 60,
    heightMm: 8,
    fullWidth: false,
    defaultValue: "",
    maxLength: 0,
    fontSizePt: 10,
    align: "left",
    options: [],
    vertical: false,
    multiSelect: false,
    action: "reset",
    ...FIELD_TYPES[type].defaults,
  };
}

function text(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function flag(value: unknown): boolean {
  return value === true;
}

// Validates untrusted input (localStorage, request body).
export function parseFormFields(value: unknown): FieldMap {
  const result: FieldMap = {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) return result;

  for (const [key, entry] of Object.entries(value).slice(0, MAX_FIELDS)) {
    if (typeof entry !== "object" || entry === null || !isFieldId(key)) continue;
    const raw = entry as Record<string, unknown>;
    const type = raw.type as FormFieldType;
    if (raw.id !== key || !FIELD_TYPE_ORDER.includes(type)) continue;

    const base = createFormField(type, {});
    const options = Array.isArray(raw.options)
      ? raw.options
          .filter((option): option is string => typeof option === "string")
          .map((option) => option.slice(0, 100))
          .slice(0, MAX_OPTIONS)
      : base.options;

    result[key] = {
      id: key,
      type,
      name: sanitizeFieldName(text(raw.name, 120), key),
      label: text(raw.label, 120),
      tooltip: text(raw.tooltip, 200),
      required: flag(raw.required),
      readOnly: flag(raw.readOnly),
      widthMm: clampNumber(raw.widthMm, SIZE_LIMITS.min, SIZE_LIMITS.max, base.widthMm),
      heightMm: clampNumber(raw.heightMm, SIZE_LIMITS.min, SIZE_LIMITS.max, base.heightMm),
      fullWidth: flag(raw.fullWidth),
      defaultValue: text(raw.defaultValue, 2000),
      maxLength: Math.round(clampNumber(raw.maxLength, 0, 5000, 0)),
      fontSizePt: clampNumber(raw.fontSizePt, 0, 72, base.fontSizePt),
      align: raw.align === "center" || raw.align === "right" ? raw.align : "left",
      options,
      vertical: flag(raw.vertical),
      multiSelect: flag(raw.multiSelect),
      action: raw.action === "print" ? "print" : "reset",
    };
  }
  return result;
}

// Placeholder for the editor export.
export function fieldPlaceholder(id: string): string {
  return `<span ${FIELD_ATTRIBUTE}="${id}"></span>`;
}

const FIELD_MARKER = /<span data-form-field="([a-z0-9][a-z0-9-]{0,39})"><\/span>/g;

// IDs of the fields used in the template (in order, without duplicates).
export function listUsedFieldIds(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(FIELD_MARKER), (match) => match[1]))];
}

// Removes all placeholders of a field from the template.
export function removeFieldFromTemplate(template: string, id: string): string {
  return template.replaceAll(fieldPlaceholder(id), "");
}

// ---------------------------------------------------------------------------
// HTML output
// ---------------------------------------------------------------------------

export type FieldTarget = "preview" | "pdf";

function sizeStyle(def: FormFieldDef, width = def.widthMm): string {
  const horizontal = def.fullWidth && ["text", "textarea", "date", "dropdown", "listbox"].includes(def.type);
  return `width:${horizontal ? "100%" : `${width}mm`};height:${def.heightMm}mm`;
}

function fieldBox(
  def: FormFieldDef,
  target: FieldTarget,
  className: string,
  option: number,
  occurrence: number,
  content = "",
): string {
  const attributes = `class="ff ${className}" style="${sizeStyle(def)}"`;
  if (target === "pdf") {
    // The link gives Chromium the rectangle; the content stays empty, pdf-lib draws the real field.
    const href = `${FIELD_LINK_BASE}${def.id}/${option}/${occurrence}`;
    const label = className === "ff-signature" ? ` data-label="${escapeHtml(def.label)}"` : "";
    return `<a ${attributes} href="${href}"${label}></a>`;
  }
  const title = escapeHtml(`${FIELD_TYPES[def.type].label}: ${def.name}${def.required ? " *" : ""}`);
  const label = className === "ff-signature" ? ` data-label="${escapeHtml(def.label)}"` : "";
  return `<span ${attributes} title="${title}"${label}>${content}</span>`;
}

function item(box: string, label: string): string {
  return `<span class="ff-item">${box}${label ? `<span class="ff-label">${escapeHtml(label)}</span>` : ""}</span>`;
}

function renderField(def: FormFieldDef, target: FieldTarget, occurrence: number): string {
  switch (def.type) {
    case "checkbox":
      return item(fieldBox(def, target, "ff-checkbox", 0, occurrence), def.label);
    case "radio": {
      const items = def.options.map((option, index) =>
        item(fieldBox(def, target, "ff-radio", index, occurrence), option),
      );
      return `<span class="ff-group${def.vertical ? " ff-group--vertical" : ""}">${items.join("")}</span>`;
    }
    case "button":
      return fieldBox(def, target, "ff-button", 0, occurrence, target === "preview" ? escapeHtml(def.label) : "");
    default:
      return fieldBox(def, target, `ff-${def.type}`, 0, occurrence);
  }
}

// Replaces the placeholders in the rendered HTML. Unknown IDs (e.g. deleted fields) disappear.
export function resolveFormFields(html: string, fields: FieldMap, target: FieldTarget): string {
  const seen = new Map<string, number>();
  return html.replace(FIELD_MARKER, (_match, id: string) => {
    if (!Object.hasOwn(fields, id)) return "";
    const occurrence = (seen.get(id) ?? 0) + 1;
    seen.set(id, occurrence);
    return renderField(fields[id], target, occurrence);
  });
}

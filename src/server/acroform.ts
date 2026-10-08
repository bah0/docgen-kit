import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  rgb,
  StandardFonts,
  TextAlignment,
  type PDFField,
  type PDFFont,
  type PDFForm,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";

import { FIELD_LINK_BASE, type FieldMap, type FormFieldDef } from "../core/form-fields";
import { defaultEngine, type TemplateEngine } from "../core/handlebars";
import type { JsonObject } from "../core/json-data";

// Converts the link annotations Chromium wrote for the field boxes
// (<a href="https://acroform.invalid/ID/Option/Occurrence">) into real AcroForm fields.
// The annotation rectangle is exactly the position and size of the box in the document.

const LINK_PATTERN = new RegExp(`^${FIELD_LINK_BASE.replace(/[.]/g, "\\.")}([a-z0-9-]{1,40})/(\\d{1,3})/(\\d{1,4})$`);

const FILL = rgb(0.94, 0.96, 1);
const BORDER = rgb(0.45, 0.5, 0.6);
const TEXT = rgb(0, 0, 0);
const BORDER_WIDTH = 0.75;

interface Placement {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  option: number;
}

type Groups = Map<string, { def: FormFieldDef; occurrence: number; placements: Placement[] }>;

function coordinate(rect: PDFArray, index: number): number {
  return rect.lookup(index, PDFNumber).asNumber();
}

function linkTarget(annotation: PDFDict): string | null {
  if (annotation.lookup(PDFName.of("Subtype"))?.toString() !== "/Link") return null;
  const action = annotation.lookupMaybe(PDFName.of("A"), PDFDict);
  const uri = action?.lookupMaybe(PDFName.of("URI"), PDFString, PDFHexString);
  return uri ? uri.decodeText() : null;
}

// Collects all field links and removes them from the pages (otherwise they would remain as clickable links).
function collectPlacements(pdf: PDFDocument, fields: FieldMap): Groups {
  const groups: Groups = new Map();

  for (const page of pdf.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;

    const kept: PDFObject[] = [];
    for (let index = 0; index < annotations.size(); index += 1) {
      const entry = annotations.get(index);
      const dict = annotations.lookupMaybe(index, PDFDict);
      const match = dict ? LINK_PATTERN.exec(linkTarget(dict) ?? "") : null;
      if (!dict || !match) {
        kept.push(entry);
        continue;
      }

      const [, id, option, occurrence] = match;
      if (!Object.hasOwn(fields, id)) continue;

      const rect = dict.lookup(PDFName.of("Rect"), PDFArray);
      const x1 = coordinate(rect, 0);
      const y1 = coordinate(rect, 1);
      const x2 = coordinate(rect, 2);
      const y2 = coordinate(rect, 3);

      const key = `${id}#${occurrence}`;
      const group = groups.get(key) ?? { def: fields[id], occurrence: Number(occurrence), placements: [] };
      group.placements.push({
        page,
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
        option: Number(option),
      });
      groups.set(key, group);
    }

    page.node.set(PDFName.of("Annots"), pdf.context.obj(kept));
  }
  return groups;
}

// Helvetica (WinAnsi) cannot encode every character; anything else is replaced with "?".
function makeSanitizer(font: PDFFont): (text: string, multiline: boolean) => string {
  const supported = new Set(font.getCharacterSet());
  return (text, multiline) =>
    Array.from(text.replace(/\r\n?/g, "\n"))
      .map((char) => {
        if (char === "\n") return multiline ? "\n" : " ";
        return supported.has(char.codePointAt(0) ?? -1) ? char : "?";
      })
      .join("");
}

// Export values must not contain special characters and must be unique within the group.
function optionValues(options: string[]): string[] {
  const used = new Set<string>();
  return options.map((option, index) => {
    const base =
      option
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || `Option_${index + 1}`;
    let value = base;
    for (let counter = 2; used.has(value); counter += 1) value = `${base}_${counter}`;
    used.add(value);
    return value;
  });
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  for (let counter = 2; used.has(name); counter += 1) name = `${base}_${counter}`;
  used.add(name);
  return name;
}

function setTooltip(dict: PDFDict, def: FormFieldDef, sanitize: ReturnType<typeof makeSanitizer>): void {
  if (def.tooltip) dict.set(PDFName.of("TU"), PDFHexString.fromText(sanitize(def.tooltip, false)));
}

function commonFlags(field: PDFField, def: FormFieldDef): void {
  if (def.required) field.enableRequired();
  if (def.readOnly) field.enableReadOnly();
}

function alignment(def: FormFieldDef): TextAlignment {
  if (def.align === "center") return TextAlignment.Center;
  if (def.align === "right") return TextAlignment.Right;
  return TextAlignment.Left;
}

// pdf-lib only reads signature fields: create the widget annotation directly and register it in the form.
function addSignature(pdf: PDFDocument, form: PDFForm, name: string, placement: Placement, def: FormFieldDef): void {
  const widget = pdf.context.obj({
    Type: "Annot",
    Subtype: "Widget",
    FT: "Sig",
    T: PDFHexString.fromText(name),
    Rect: [placement.x, placement.y, placement.x + placement.width, placement.y + placement.height],
    F: 4,
    P: placement.page.ref,
    ...(def.required ? { Ff: 2 } : {}),
  });
  if (def.tooltip) widget.set(PDFName.of("TU"), PDFHexString.fromText(def.tooltip));
  const ref = pdf.context.register(widget);
  placement.page.node.addAnnot(ref);
  form.acroForm.addField(ref);
}

// Creates the form fields from the found link positions. Returns null if the
// PDF contains no field links (the Gotenberg PDF then stays unchanged).
export async function applyAcroForm(
  pdfBytes: Uint8Array | ArrayBuffer,
  fields: FieldMap,
  data: JsonObject,
  engine: TemplateEngine = defaultEngine,
): Promise<Uint8Array | null> {
  const pdf = await PDFDocument.load(pdfBytes);
  const groups = collectPlacements(pdf, fields);
  if (groups.size === 0) return null;

  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const sanitize = makeSanitizer(font);
  const names = new Set<string>();

  for (const { def, occurrence, placements } of groups.values()) {
    const base = sanitize(def.name, false) || def.id;
    const name = uniqueName(occurrence > 1 ? `${base}_${occurrence}` : base, names);
    const appearance = { font, textColor: TEXT, backgroundColor: FILL, borderColor: BORDER, borderWidth: BORDER_WIDTH };
    const rectOf = (placement: Placement) => ({
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    const initial = sanitize(engine.renderPlainText(def.defaultValue, data).trim(), def.type === "textarea");
    let field: PDFField | null = null;

    switch (def.type) {
      case "text":
      case "textarea":
      case "date": {
        const text = form.createTextField(name);
        if (def.maxLength > 0) text.setMaxLength(def.maxLength);
        if (initial) text.setText(def.maxLength > 0 ? initial.slice(0, def.maxLength) : initial);
        text.setAlignment(alignment(def));
        if (def.type === "textarea") {
          text.enableMultiline();
          text.enableScrolling();
        }
        if (def.type === "date") {
          // Acrobat script: enforces and formats DD.MM.YYYY.
          text.acroField.dict.set(
            PDFName.of("AA"),
            pdf.context.obj({
              K: { Type: "Action", S: "JavaScript", JS: PDFString.of('AFDate_KeystrokeEx("yyyy-mm-dd");') },
              F: { Type: "Action", S: "JavaScript", JS: PDFString.of('AFDate_FormatEx("yyyy-mm-dd");') },
            }),
          );
        }
        for (const placement of placements) text.addToPage(placement.page, { ...rectOf(placement), ...appearance });
        // setFontSize needs the /DA entry that addToPage creates.
        if (def.fontSizePt > 0) text.setFontSize(def.fontSizePt);
        field = text;
        break;
      }

      case "checkbox": {
        const checkbox = form.createCheckBox(name);
        for (const placement of placements) {
          checkbox.addToPage(placement.page, { ...rectOf(placement), ...appearance });
        }
        // Only after the widgets exist, otherwise they do not get the "on" state.
        if (/^(true|ja|yes|1|on)$/i.test(initial)) checkbox.check();
        field = checkbox;
        break;
      }

      case "radio": {
        const group = form.createRadioGroup(name);
        const values = optionValues(def.options);
        for (const placement of placements) {
          const value = values[placement.option] ?? `Option_${placement.option + 1}`;
          group.addOptionToPage(value, placement.page, { ...rectOf(placement), ...appearance });
        }
        const selected = def.options.indexOf(initial);
        if (selected >= 0 && values[selected] && group.getOptions().includes(values[selected])) {
          group.select(values[selected]);
        }
        field = group;
        break;
      }

      case "dropdown":
      case "listbox": {
        const options = def.options.map((option) => sanitize(option, false));
        const choice = def.type === "dropdown" ? form.createDropdown(name) : form.createOptionList(name);
        if (options.length > 0) choice.addOptions(options);
        if (def.type === "listbox" && def.multiSelect && "enableMultiselect" in choice) choice.enableMultiselect();
        if (initial && options.includes(initial)) choice.select(initial);
        for (const placement of placements) choice.addToPage(placement.page, { ...rectOf(placement), ...appearance });
        if (def.fontSizePt > 0) choice.setFontSize(def.fontSizePt);
        field = choice;
        break;
      }

      case "button": {
        const button = form.createButton(name);
        const caption = sanitize(def.label || "OK", false);
        for (const placement of placements) {
          button.addToPage(caption, placement.page, { ...rectOf(placement), ...appearance, backgroundColor: rgb(0.88, 0.9, 0.95) });
        }
        button.setFontSize(def.fontSizePt > 0 ? def.fontSizePt : 10);
        const action =
          def.action === "print"
            ? { Type: "Action", S: "JavaScript", JS: PDFString.of("this.print();") }
            : { Type: "Action", S: "ResetForm" };
        for (const widget of button.acroField.getWidgets()) widget.dict.set(PDFName.of("A"), pdf.context.obj(action));
        field = button;
        break;
      }

      case "signature": {
        // Multiple placements with the same name would be invalid: only the first.
        addSignature(pdf, form, name, placements[0], def);
        break;
      }
    }

    if (field) {
      commonFlags(field, def);
      setTooltip(field.acroField.dict, def, sanitize);
    }
  }

  form.updateFieldAppearances(font);
  return pdf.save();
}

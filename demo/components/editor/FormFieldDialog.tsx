"use client";

import { useState, type ReactNode } from "react";

import { NumberField, SELECT_CLASS } from "@/components/editor/PageSettingsPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD_TYPES,
  SIZE_LIMITS,
  sanitizeFieldName,
  type FieldAlign,
  type FieldMap,
  type FormFieldDef,
} from "docgen-kit";

interface FormFieldDialogProps {
  // The field being edited; null = dialog closed.
  field: FormFieldDef | null;
  // All fields (for the duplicate name warning).
  fields: FieldMap;
  onSave: (field: FormFieldDef) => void;
  onClose: () => void;
}

const TEXT_LIKE = ["text", "textarea", "date"];
const WITH_FONT = ["text", "textarea", "date", "dropdown", "listbox", "button"];
const WITH_LABEL = ["checkbox", "signature", "button"];
const WITH_OPTIONS = ["radio", "dropdown", "listbox"];

function Row({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Check({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}

// Properties of a form field. The content is rebuilt per field (key) so the draft
// always matches the stored state when opened.
export function FormFieldDialog({ field, fields, onSave, onClose }: FormFieldDialogProps) {
  return (
    <Dialog open={field !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {field && <FieldForm key={field.id} field={field} fields={fields} onSave={onSave} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function FieldForm({
  field,
  fields,
  onSave,
  onClose,
}: {
  field: FormFieldDef;
  fields: FieldMap;
  onSave: (field: FormFieldDef) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(field);
  const [optionsText, setOptionsText] = useState(field.options.join("\n"));
  const patch = (changes: Partial<FormFieldDef>) => setDraft((current) => ({ ...current, ...changes }));

  const type = draft.type;
  const id = `ff-${field.id}`;
  const name = sanitizeFieldName(draft.name, "");
  const duplicate = Object.values(fields).some((other) => other.id !== field.id && other.name === name);
  const hasName = name.length > 0;
  const optionList = optionsText
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
  const needsOptions = WITH_OPTIONS.includes(type) && optionList.length === 0;

  const save = () => {
    onSave({ ...draft, name, options: WITH_OPTIONS.includes(type) ? optionList : draft.options });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{FIELD_TYPES[type].label}</DialogTitle>
        <DialogDescription>
          The field is created in the PDF at this position and size as a fillable form field.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Row
            label="Field name (in the PDF)"
            htmlFor={`${id}-name`}
            hint={duplicate ? "Name is already in use; a number is appended in the PDF." : undefined}
          >
            <Input
              id={`${id}-name`}
              value={draft.name}
              aria-invalid={!hasName || duplicate}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Row>
          <Row label="Tooltip" htmlFor={`${id}-tooltip`}>
            <Input id={`${id}-tooltip`} value={draft.tooltip} onChange={(event) => patch({ tooltip: event.target.value })} />
          </Row>
        </div>

        {WITH_LABEL.includes(type) && (
          <Row label={type === "button" ? "Caption" : "Label (visible in the document)"} htmlFor={`${id}-label`}>
            <Input id={`${id}-label`} value={draft.label} onChange={(event) => patch({ label: event.target.value })} />
          </Row>
        )}

        {WITH_OPTIONS.includes(type) && (
          <Row label="Options (one per line)" htmlFor={`${id}-options`}>
            <Textarea
              id={`${id}-options`}
              value={optionsText}
              rows={4}
              spellCheck={false}
              className="field-sizing-fixed h-24 resize-y"
              onChange={(event) => setOptionsText(event.target.value)}
            />
          </Row>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Row label={type === "radio" ? "Circle size (mm)" : "Width (mm)"} htmlFor={`${id}-width`}>
            <NumberField
              id={`${id}-width`}
              value={draft.widthMm}
              min={SIZE_LIMITS.min}
              max={SIZE_LIMITS.max}
              step={0.5}
              disabled={draft.fullWidth}
              onCommit={(widthMm) => patch(type === "radio" ? { widthMm, heightMm: widthMm } : { widthMm })}
            />
          </Row>
          <Row label="Height (mm)" htmlFor={`${id}-height`}>
            <NumberField
              id={`${id}-height`}
              value={draft.heightMm}
              min={SIZE_LIMITS.min}
              max={SIZE_LIMITS.max}
              step={0.5}
              disabled={type === "radio"}
              onCommit={(heightMm) => patch({ heightMm })}
            />
          </Row>
          {WITH_FONT.includes(type) && (
            <Row label="Font size (pt, 0 = auto)" htmlFor={`${id}-font`}>
              <NumberField
                id={`${id}-font`}
                value={draft.fontSizePt}
                min={0}
                max={72}
                onCommit={(fontSizePt) => patch({ fontSizePt })}
              />
            </Row>
          )}
        </div>

        {["text", "textarea", "date", "dropdown", "listbox"].includes(type) && (
          <Check id={`${id}-full`} checked={draft.fullWidth} onChange={(fullWidth) => patch({ fullWidth })}>
            Full line width
          </Check>
        )}

        {TEXT_LIKE.includes(type) && (
          <div className="grid grid-cols-2 gap-3">
            <Row label="Alignment" htmlFor={`${id}-align`}>
              <select
                id={`${id}-align`}
                className={SELECT_CLASS}
                value={draft.align}
                onChange={(event) => patch({ align: event.target.value as FieldAlign })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Row>
            <Row label="Max. characters (0 = unlimited)" htmlFor={`${id}-max`}>
              <NumberField
                id={`${id}-max`}
                value={draft.maxLength}
                min={0}
                max={5000}
                onCommit={(maxLength) => patch({ maxLength: Math.round(maxLength) })}
              />
            </Row>
          </div>
        )}

        {type !== "signature" && type !== "button" && (
          <Row
            label={type === "checkbox" ? "Default value" : "Default value (placeholders allowed, e.g. {{customer.name}})"}
            htmlFor={`${id}-default`}
          >
            {type === "checkbox" ? (
              <select
                id={`${id}-default`}
                className={SELECT_CLASS}
                value={draft.defaultValue === "true" ? "true" : "false"}
                onChange={(event) => patch({ defaultValue: event.target.value })}
              >
                <option value="false">Not checked</option>
                <option value="true">Checked</option>
              </select>
            ) : type === "textarea" ? (
              <Textarea
                id={`${id}-default`}
                value={draft.defaultValue}
                rows={3}
                className="field-sizing-fixed h-20 resize-y"
                onChange={(event) => patch({ defaultValue: event.target.value })}
              />
            ) : (
              <Input
                id={`${id}-default`}
                value={draft.defaultValue}
                onChange={(event) => patch({ defaultValue: event.target.value })}
              />
            )}
          </Row>
        )}

        {type === "button" && (
          <Row label="Action" htmlFor={`${id}-action`}>
            <select
              id={`${id}-action`}
              className={SELECT_CLASS}
              value={draft.action}
              onChange={(event) => patch({ action: event.target.value === "print" ? "print" : "reset" })}
            >
              <option value="reset">Reset the form</option>
              <option value="print">Print the document</option>
            </select>
          </Row>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {type !== "button" && (
            <Check id={`${id}-required`} checked={draft.required} onChange={(required) => patch({ required })}>
              Required field
            </Check>
          )}
          {type !== "button" && type !== "signature" && (
            <Check id={`${id}-readonly`} checked={draft.readOnly} onChange={(readOnly) => patch({ readOnly })}>
              Read-only
            </Check>
          )}
          {type === "radio" && (
            <Check id={`${id}-vertical`} checked={draft.vertical} onChange={(vertical) => patch({ vertical })}>
              Options stacked vertically
            </Check>
          )}
          {type === "listbox" && (
            <Check id={`${id}-multi`} checked={draft.multiSelect} onChange={(multiSelect) => patch({ multiSelect })}>
              Multi-select
            </Check>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={!hasName || needsOptions}>
          Apply
        </Button>
      </DialogFooter>
    </>
  );
}

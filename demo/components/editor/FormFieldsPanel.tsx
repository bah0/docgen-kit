"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FIELD_TYPES, listUsedFieldIds, type FieldMap } from "docgen-kit";

interface FormFieldsPanelProps {
  fields: FieldMap;
  template: string;
  onEdit: (id: string) => void;
  // Deletes the field together with its placeholders in the template.
  onRemove: (id: string) => void;
}

function countUsage(template: string, id: string): number {
  return template.split(`data-form-field="${id}"`).length - 1;
}

// List of the document's form fields. They are inserted via the editor toolbar.
export function FormFieldsPanel({ fields, template, onEdit, onRemove }: FormFieldsPanelProps) {
  const list = Object.values(fields);
  const used = new Set(listUsedFieldIds(template));

  const remove = (id: string, name: string) => {
    const usage = countUsage(template, id);
    const message =
      usage > 0 ? `“${name}” is used ${usage}× in the template. Delete the field including its placeholders?` : `Delete “${name}”?`;
    if (window.confirm(message)) onRemove(id);
  };

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No form fields yet. Choose “Insert form field” in the editor toolbar.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {list.map((field) => (
        <li key={field.id} className="flex items-center gap-3 rounded-lg border p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{field.name}</p>
            <p className="text-xs text-muted-foreground">
              {FIELD_TYPES[field.type].label}
              {field.fullWidth ? " · full width" : ` · ${field.widthMm} × ${field.heightMm} mm`}
              {field.required ? " · required" : ""}
            </p>
          </div>
          <Badge variant={used.has(field.id) ? "secondary" : "outline"}>
            {used.has(field.id) ? `used ${countUsage(template, field.id)}×` : "unused"}
          </Badge>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => onEdit(field.id)} aria-label="Properties">
            <Pencil />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => remove(field.id, field.name)}
            aria-label="Delete field"
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}

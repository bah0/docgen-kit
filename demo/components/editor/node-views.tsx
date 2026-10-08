"use client";

import { FIELD_TYPES, type FormFieldDef } from "docgen-kit";
import type { FormFieldViewProps, ImageViewProps, NodeViews, TemplateBlockViewProps } from "docgen-kit/react";
import { Braces, ChevronDown, ChevronUp, Settings2, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// shadcn/Tailwind styled views for docgen-kit's editor nodes (see NodeViewsProvider in LexicalEditor.tsx).

function TemplateBlockView({ blockId, label, markup, onMarkupChange, onRemove }: TemplateBlockViewProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = markup.split("\n");
  const preview = lines.slice(0, 3).join("\n");

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-dashed border-sky-400/70 bg-sky-50/60 text-left font-sans text-sm dark:bg-sky-950/20">
      <div className="flex items-center gap-2 border-b border-dashed border-sky-400/50 px-2.5 py-1.5">
        <Braces className="size-4 shrink-0 text-sky-600" aria-hidden />
        <span className="truncate font-medium">{label}</span>
        <code className="truncate text-xs text-muted-foreground">{blockId}</code>
        <span className="ml-auto flex shrink-0 gap-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
            {expanded ? "Collapse" : "Edit markup"}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={onRemove} aria-label="Remove block">
            <Trash2 />
          </Button>
        </span>
      </div>
      {expanded ? (
        <Textarea
          value={markup}
          onChange={(event) => onMarkupChange(event.target.value)}
          spellCheck={false}
          aria-label={`Handlebars markup of ${label}`}
          className="field-sizing-fixed h-56 resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-5 focus-visible:ring-0"
        />
      ) : (
        <pre className="max-h-20 overflow-hidden px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
          {preview}
          {lines.length > 3 ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}

function ImageView({ asset, widthMm, alt, selected, onSelect, onWidthChange, onRemove }: ImageViewProps) {
  const [draft, setDraft] = useState(String(widthMm));

  return (
    <span
      className={cn("relative inline-block cursor-pointer align-bottom", selected && "outline-2 outline-sky-500")}
      onClick={(event) => onSelect(event.shiftKey)}
    >
      {asset ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI from the image list, next/image not possible
        <img
          src={asset.dataUri}
          alt={alt}
          draggable={false}
          style={{ width: `${widthMm}mm`, maxWidth: "100%", height: "auto", display: "block" }}
        />
      ) : (
        <span className="inline-block rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">
          Image missing
        </span>
      )}
      {selected && (
        <span
          className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-md border bg-popover p-1 text-xs text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          <label className="flex items-center gap-1">
            Width
            <input
              type="number"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                onWidthChange(Number(event.target.value));
              }}
              className="h-6 w-14 rounded border bg-background px-1"
            />
            mm
          </label>
          <Button type="button" size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Remove image">
            <Trash2 />
          </Button>
        </span>
      )}
    </span>
  );
}

const BOX = "inline-block shrink-0 box-border border border-slate-400 bg-sky-50 align-middle";
const TEXTUAL: FormFieldDef["type"][] = ["text", "textarea", "date", "dropdown", "listbox"];

function boxStyle(field: FormFieldDef): CSSProperties {
  const horizontal = field.fullWidth && TEXTUAL.includes(field.type);
  return { width: horizontal ? "100%" : `${field.widthMm}mm`, height: `${field.heightMm}mm`, maxWidth: "100%" };
}

function Caption({ children }: { children: string }) {
  return <span className="block truncate px-1 text-[10px] leading-none text-slate-500">{children}</span>;
}

function FieldVisual({ field }: { field: FormFieldDef }) {
  const style = boxStyle(field);

  switch (field.type) {
    case "checkbox":
      return (
        <span className="mr-3 inline-flex items-center gap-1.5 align-middle">
          <span className={cn(BOX, "rounded-[1px]")} style={style} />
          {field.label && <span>{field.label}</span>}
        </span>
      );
    case "radio":
      return (
        <span className={cn("inline-flex flex-wrap gap-x-4 gap-y-1 align-middle", field.vertical && "flex-col")}>
          {field.options.map((option, index) => (
            <span key={`${option}-${index}`} className="inline-flex items-center gap-1.5">
              <span className={cn(BOX, "rounded-full")} style={style} />
              <span>{option}</span>
            </span>
          ))}
        </span>
      );
    case "signature":
      return (
        <span className="relative mb-4 inline-block align-middle" style={{ ...style, borderBottom: "1px solid #374151" }}>
          <span className="absolute left-0 top-full mt-0.5 whitespace-nowrap text-[10px] leading-none text-slate-500">
            {field.label}
          </span>
        </span>
      );
    case "button":
      return (
        <span className={cn(BOX, "grid place-items-center rounded-[2px] bg-slate-200 text-[11px] font-semibold")} style={style}>
          {field.label}
        </span>
      );
    default:
      return (
        <span className={cn(BOX, "relative rounded-[2px]")} style={style}>
          <Caption>{field.name}</Caption>
          {field.type === "dropdown" && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">▾</span>
          )}
        </span>
      );
  }
}

function FormFieldView({ field, selected, onSelect, onEdit, onRemove }: FormFieldViewProps) {
  return (
    <span
      className={cn(
        "relative cursor-pointer align-middle",
        field?.fullWidth && TEXTUAL.includes(field.type) ? "block w-full" : "inline-block",
        selected && "outline-2 outline-sky-500",
      )}
      title={field ? `${FIELD_TYPES[field.type].label}: ${field.name}` : undefined}
      onClick={(event) => onSelect(event.shiftKey)}
      onDoubleClick={() => field && onEdit()}
    >
      {field ? (
        <FieldVisual field={field} />
      ) : (
        <span className="inline-block rounded border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
          Field missing
        </span>
      )}
      {selected && (
        <span
          className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-md border bg-popover p-1 text-xs text-popover-foreground shadow-md"
          onClick={(event) => event.stopPropagation()}
        >
          {field && (
            <Button type="button" size="xs" variant="ghost" onClick={onEdit}>
              <Settings2 /> Properties
            </Button>
          )}
          <Button type="button" size="icon-xs" variant="ghost" onClick={onRemove} aria-label="Remove field">
            <Trash2 />
          </Button>
        </span>
      )}
    </span>
  );
}

export const demoNodeViews: NodeViews = {
  TemplateBlock: TemplateBlockView,
  Image: ImageView,
  FormField: FormFieldView,
};

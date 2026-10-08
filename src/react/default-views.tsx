"use client";

import { useState, type CSSProperties } from "react";

import { FIELD_TYPES, type FormFieldDef } from "../core/form-fields";
import type { FormFieldViewProps, ImageViewProps, NodeViews, TemplateBlockViewProps } from "./node-views";

// Minimal, dependency-free views with inline styles. They work out of the box; replace them
// with <NodeViewsProvider> to match your own design.

const buttonStyle: CSSProperties = { font: "inherit", fontSize: 12, padding: "2px 8px", cursor: "pointer" };
const boxStyle: CSSProperties = {
  display: "inline-block",
  boxSizing: "border-box",
  border: "1px solid #94a3b8",
  background: "#f0f9ff",
  verticalAlign: "middle",
};

function TemplateBlockView({ label, blockId, markup, onMarkupChange, onRemove }: TemplateBlockViewProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = markup.split("\n");

  return (
    <div style={{ margin: "8px 0", border: "1px dashed #38bdf8", borderRadius: 8, background: "#f0f9ff", font: "13px system-ui" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px" }}>
        <strong>{label}</strong>
        <code style={{ color: "#64748b" }}>{blockId}</code>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button type="button" style={buttonStyle} onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Collapse" : "Edit markup"}
          </button>
          <button type="button" style={buttonStyle} onClick={onRemove} aria-label="Remove block">
            ×
          </button>
        </span>
      </div>
      {expanded ? (
        <textarea
          value={markup}
          spellCheck={false}
          aria-label={`Handlebars markup of ${label}`}
          onChange={(event) => onMarkupChange(event.target.value)}
          style={{ display: "block", width: "100%", height: 220, boxSizing: "border-box", font: "12px monospace", border: 0, borderTop: "1px dashed #38bdf8" }}
        />
      ) : (
        <pre style={{ margin: 0, padding: "6px 10px", maxHeight: 72, overflow: "hidden", font: "12px monospace", color: "#64748b" }}>
          {lines.slice(0, 3).join("\n")}
          {lines.length > 3 ? "\n…" : ""}
        </pre>
      )}
    </div>
  );
}

function ImageView({ asset, widthMm, alt, selected, onSelect, onWidthChange, onRemove }: ImageViewProps) {
  return (
    <span
      style={{ position: "relative", display: "inline-block", cursor: "pointer", outline: selected ? "2px solid #0ea5e9" : "none" }}
      onClick={(event) => onSelect(event.shiftKey)}
    >
      {asset ? (
        <img src={asset.dataUri} alt={alt} draggable={false} style={{ display: "block", width: `${widthMm}mm`, maxWidth: "100%", height: "auto" }} />
      ) : (
        <span style={{ ...boxStyle, padding: "2px 8px", borderStyle: "dashed", fontSize: 12 }}>Image missing</span>
      )}
      {selected && (
        <span
          style={{ position: "absolute", left: 0, top: "100%", zIndex: 10, marginTop: 4, display: "flex", gap: 6, alignItems: "center", padding: 4, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, font: "12px system-ui" }}
          onClick={(event) => event.stopPropagation()}
        >
          <label>
            Width{" "}
            <input type="number" value={widthMm} style={{ width: 56 }} onChange={(event) => onWidthChange(Number(event.target.value))} /> mm
          </label>
          <button type="button" style={buttonStyle} onClick={onRemove} aria-label="Remove image">
            ×
          </button>
        </span>
      )}
    </span>
  );
}

function sizeStyle(field: FormFieldDef): CSSProperties {
  const horizontal = field.fullWidth && ["text", "textarea", "date", "dropdown", "listbox"].includes(field.type);
  return { width: horizontal ? "100%" : `${field.widthMm}mm`, height: `${field.heightMm}mm`, maxWidth: "100%" };
}

function FieldVisual({ field }: { field: FormFieldDef }) {
  const style = { ...boxStyle, ...sizeStyle(field) };
  switch (field.type) {
    case "checkbox":
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12 }}>
          <span style={style} />
          {field.label}
        </span>
      );
    case "radio":
      return (
        <span style={{ display: "inline-flex", flexDirection: field.vertical ? "column" : "row", flexWrap: "wrap", gap: 6, verticalAlign: "middle" }}>
          {field.options.map((option, index) => (
            <span key={`${option}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12 }}>
              <span style={{ ...style, borderRadius: "50%" }} />
              {option}
            </span>
          ))}
        </span>
      );
    case "signature":
      return <span style={{ ...style, background: "transparent", border: 0, borderBottom: "1px solid #374151", marginBottom: 14 }}>{field.label}</span>;
    case "button":
      return <span style={{ ...style, display: "inline-grid", placeItems: "center", background: "#e2e8f0", fontSize: 11, fontWeight: 600 }}>{field.label}</span>;
    default:
      return <span style={{ ...style, fontSize: 10, color: "#64748b", padding: "0 4px", overflow: "hidden" }}>{field.name}</span>;
  }
}

function FormFieldView({ field, selected, onSelect, onEdit, onRemove }: FormFieldViewProps) {
  const full = field?.fullWidth && ["text", "textarea", "date", "dropdown", "listbox"].includes(field.type);
  return (
    <span
      style={{ position: "relative", display: full ? "block" : "inline-block", cursor: "pointer", outline: selected ? "2px solid #0ea5e9" : "none" }}
      title={field ? `${FIELD_TYPES[field.type].label}: ${field.name}` : undefined}
      onClick={(event) => onSelect(event.shiftKey)}
      onDoubleClick={onEdit}
    >
      {field ? <FieldVisual field={field} /> : <span style={{ ...boxStyle, padding: "0 8px", borderStyle: "dashed", fontSize: 12 }}>Field missing</span>}
      {selected && (
        <span
          style={{ position: "absolute", left: 0, top: "100%", zIndex: 10, marginTop: 4, display: "flex", gap: 4, padding: 4, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6 }}
          onClick={(event) => event.stopPropagation()}
        >
          {field && (
            <button type="button" style={buttonStyle} onClick={onEdit}>
              Properties
            </button>
          )}
          <button type="button" style={buttonStyle} onClick={onRemove} aria-label="Remove field">
            ×
          </button>
        </span>
      )}
    </span>
  );
}

export const defaultNodeViews: NodeViews = {
  TemplateBlock: TemplateBlockView,
  Image: ImageView,
  FormField: FormFieldView,
};

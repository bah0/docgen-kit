"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatJson } from "docgen-kit";
import { cn } from "@/lib/utils";

export interface JsonDataEditorProps {
  value: string;
  onChange: (text: string) => void;
  // null = valid; otherwise the parser's error message.
  error: string | null;
  onReset?: () => void;
  label?: string;
  className?: string;
  // Textarea height as a Tailwind class.
  heightClassName?: string;
}

// Editable JSON data. The text is kept even with syntax errors; the parent decides based on `error`
// whether to use the data (preview: last valid state, PDF: blocked).
export function JsonDataEditor({
  value,
  onChange,
  error,
  onReset,
  label = "JSON data",
  className,
  heightClassName = "h-72",
}: JsonDataEditorProps) {
  const format = () => {
    try {
      onChange(formatJson(JSON.parse(value)));
    } catch {
      // Invalid JSON cannot be formatted; the error message is already visible.
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {error === null ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="text-emerald-600" /> valid
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle /> invalid
          </Badge>
        )}
        <span className="ml-auto flex gap-1">
          <Button type="button" size="xs" variant="outline" onClick={format} disabled={error !== null}>
            Format
          </Button>
          {onReset && (
            <Button type="button" size="xs" variant="outline" onClick={onReset}>
              Reset
            </Button>
          )}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={label}
        aria-invalid={error !== null}
        className={cn("field-sizing-fixed resize-y font-mono text-xs leading-5", heightClassName)}
      />
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

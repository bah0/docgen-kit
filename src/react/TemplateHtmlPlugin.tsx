"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HISTORY_MERGE_TAG } from "lexical";
import { useEffect, useRef } from "react";

import { $importTemplateHtml, exportTemplateHtml } from "./lexical-html";

export interface TemplateHtmlPluginProps {
  // Current template (Handlebars HTML). Changes that did not come from the editor itself
  // (reset, block inserted elsewhere) are imported into the editor.
  html: string;
  // Called with the raw template string (unprocessed {{placeholders}}) whenever the editor content changes.
  onChange: (html: string) => void;
}

// Keeps editor state and template string in sync:
//  - editor change -> exportTemplateHtml() -> onChange(html)
//  - new `html` prop (not from the editor itself) -> $importTemplateHtml()
export function TemplateHtmlPlugin({ html, onChange }: TemplateHtmlPluginProps) {
  const [editor] = useLexicalComposerContext();
  const lastHtml = useRef(html);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (html === lastHtml.current) return;
    lastHtml.current = html;
    // history-merge: The import is not its own undo step and does not trigger onChange.
    editor.update(() => $importTemplateHtml(editor, html), { tag: HISTORY_MERGE_TAG });
  }, [editor, html]);

  useEffect(
    () =>
      editor.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves }) => {
        if (tags.has(HISTORY_MERGE_TAG)) return;
        // Pure cursor movements do not change the template.
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        const next = exportTemplateHtml(editor);
        if (next === lastHtml.current) return;
        lastHtml.current = next;
        onChangeRef.current(next);
      }),
    [editor],
  );

  return null;
}

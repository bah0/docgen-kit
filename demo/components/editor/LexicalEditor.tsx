"use client";

import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import type { AssetMap, DocumentBlock, FieldMap, FormFieldDef, ImageAsset, LoopOption, VariableOption } from "docgen-kit";
import {
  $importTemplateHtml,
  AssetsContext,
  FormFieldsContext,
  NodeViewsProvider,
  TemplateHtmlPlugin,
  templateNodes,
} from "docgen-kit/react";
import { useMemo, useState } from "react";

import { demoNodeViews } from "@/components/editor/node-views";
import { Toolbar } from "@/components/editor/Toolbar";
import { cn } from "@/lib/utils";

export interface LexicalEditorProps {
  // Current template (Handlebars HTML). External changes (reset, block from the library)
  // are taken over into the editor.
  html: string;
  // Delivers the raw HTML string with unprocessed {{placeholders}}.
  onChange: (html: string) => void;
  variables: VariableOption[];
  loops: LoopOption[];
  // Image list of the document (for <img src="asset:ID"> in the editor) and callback for new uploads.
  assets: AssetMap;
  onAddAsset: (asset: ImageAsset) => void;
  // Form fields of the document: saving new/changed fields and opening the properties dialog.
  fields: FieldMap;
  onSaveField: (field: FormFieldDef) => void;
  onEditField: (id: string) => void;
  onBlockInserted?: (block: DocumentBlock) => void;
  className?: string;
}

// No theme classes: Lexical's exportDOM() would otherwise write them into the template.
// The editor styling instead comes from descendant selectors on the ContentEditable.
const EDITOR_SURFACE =
  "min-h-[18rem] px-4 py-3 text-sm leading-6 outline-none " +
  "[&_p]:mb-2 [&_strong]:font-bold [&_em]:italic [&_u]:underline " +
  "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-bold " +
  "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-semibold " +
  "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-lg [&_h3]:font-semibold " +
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-0.5";

export function LexicalEditor({
  html,
  onChange,
  variables,
  loops,
  assets,
  onAddAsset,
  fields,
  onSaveField,
  onEditField,
  onBlockInserted,
  className,
}: LexicalEditorProps) {
  // The initial state is read only once.
  const [initialHtml] = useState(html);
  const fieldsContext = useMemo(() => ({ fields, onSaveField, onEditField }), [fields, onSaveField, onEditField]);

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "template-editor",
        nodes: [HeadingNode, ListNode, ListItemNode, ...templateNodes],
        editorState: (editor) => $importTemplateHtml(editor, initialHtml),
        onError: (error) => console.error(error),
      }}
    >
      <AssetsContext.Provider value={assets}>
        <FormFieldsContext.Provider value={fieldsContext}>
          <NodeViewsProvider views={demoNodeViews}>
            <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
              <Toolbar
                variables={variables}
                loops={loops}
                assets={assets}
                onAddAsset={onAddAsset}
                onBlockInserted={onBlockInserted}
              />
              <div className="relative max-h-[32rem] overflow-y-auto">
                <RichTextPlugin
                  contentEditable={<ContentEditable aria-label="Template editor" className={EDITOR_SURFACE} />}
                  placeholder={
                    <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
                      Write the template …
                    </div>
                  }
                  ErrorBoundary={LexicalErrorBoundary}
                />
              </div>
            </div>
            <HistoryPlugin />
            <ListPlugin />
            <TemplateHtmlPlugin html={html} onChange={onChange} />
          </NodeViewsProvider>
        </FormFieldsContext.Provider>
      </AssetsContext.Provider>
    </LexicalComposer>
  );
}

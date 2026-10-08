"use client";

import {
  extractVariablePaths,
  formatJson,
  mergeMissing,
  parseJsonObject,
  removeFieldFromTemplate,
  type DocumentBlock,
  type DocumentSettings,
  type FormFieldDef,
  type ImageAsset,
  type JsonObject,
} from "docgen-kit";
import { fetchPdf } from "docgen-kit/client";
import { FileText, LoaderCircle, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { FormFieldDialog } from "@/components/editor/FormFieldDialog";
import { FormFieldsPanel } from "@/components/editor/FormFieldsPanel";
import { ImageLibrary } from "@/components/editor/ImageLibrary";
import { JsonDataEditor } from "@/components/editor/JsonDataEditor";
import { LexicalEditor } from "@/components/editor/LexicalEditor";
import { PageSettingsPanel } from "@/components/editor/PageSettingsPanel";
import { A4IFramePreview } from "@/components/preview/A4IFramePreview";
import { PdfComparisonPanel, type PdfState } from "@/components/preview/PdfComparisonPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  clearStoredDocument,
  defaultDocument,
  parseStoredDocument,
  readStoredDocument,
  readStoredDocumentRaw,
  subscribeToDocument,
  writeStoredDocument,
  type StoredDocument,
} from "@/lib/document-store";
import { documentConfigs, type DocumentId } from "@/lib/document-templates";

interface DocumentWorkbenchProps {
  documentId: DocumentId;
}

type PanelTab = "preview" | "pdf";

const subscribeNothing = () => () => {};

// The state lives in localStorage and does not exist on the server. The actual editor is only rendered
// after hydration so the server and client HTML stay identical.
export function DocumentWorkbench(props: DocumentWorkbenchProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return mounted ? <WorkbenchContent {...props} /> : <WorkbenchSkeleton />;
}

export function WorkbenchSkeleton() {
  return (
    <div className="grid h-full min-h-[24rem] place-items-center text-sm text-muted-foreground">
      Loading editor …
    </div>
  );
}

function WorkbenchContent({ documentId }: DocumentWorkbenchProps) {
  const config = documentConfigs[documentId];
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("preview");
  const [pdf, setPdf] = useState<PdfState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  // Only released on replacement: Next.js keeps visited routes in the background, a cleanup on hiding
  // would invalidate the URL of the displayed PDF.
  const pdfUrlRef = useRef<string | null>(null);

  // --- Document state: lives in localStorage (lib/document-store.ts) -----------
  // useSyncExternalStore keeps the editor, block library and other tabs in sync automatically,
  // even when Next.js keeps a previously visited route in the background.
  const subscribe = useCallback((onChange: () => void) => subscribeToDocument(documentId, onChange), [documentId]);
  const raw = useSyncExternalStore(
    subscribe,
    () => readStoredDocumentRaw(documentId),
    () => null,
  );
  const doc = useMemo<StoredDocument>(
    () => parseStoredDocument(raw, documentId) ?? defaultDocument(documentId),
    [raw, documentId],
  );

  // Partial updates always read the fresh stored state, so concurrent changes
  // (editor export and JSON additions by a block) do not overwrite each other.
  const updateDoc = useCallback(
    (patch: Partial<StoredDocument>) => {
      writeStoredDocument(documentId, { ...readStoredDocument(documentId), ...patch });
    },
    [documentId],
  );

  // --- JSON data ---------------------------------------------------------------
  const parsed = useMemo(() => parseJsonObject(doc.json), [doc.json]);

  // While the JSON is invalid, the preview keeps rendering with the last valid state.
  const [lastValid, setLastValid] = useState<JsonObject>(() => (parsed.ok ? parsed.value : {}));
  if (parsed.ok && parsed.value !== lastValid) setLastValid(parsed.value);

  const { variables, loops } = useMemo(() => extractVariablePaths(lastValid), [lastValid]);

  // --- Changes from editor, JSON and settings -----------------------------
  const handleTemplateChange = useCallback((template: string) => updateDoc({ template }), [updateDoc]);
  const handleJsonChange = useCallback((json: string) => updateDoc({ json }), [updateDoc]);
  const handleSettingsChange = useCallback((settings: DocumentSettings) => updateDoc({ settings }), [updateDoc]);

  // Read the fresh stored state so an upload right after inserting in the editor is not lost.
  const handleAddAsset = useCallback(
    (asset: ImageAsset) => {
      updateDoc({ assets: { ...readStoredDocument(documentId).assets, [asset.id]: asset } });
    },
    [documentId, updateDoc],
  );

  const handleRemoveAsset = useCallback(
    (id: string) => {
      const rest = { ...readStoredDocument(documentId).assets };
      delete rest[id];
      updateDoc({ assets: rest });
    },
    [documentId, updateDoc],
  );

  // Form fields: also read the fresh stored state here. The dialog belongs to the workbench,
  // so editor nodes and the field list edit the same properties.
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const handleSaveField = useCallback(
    (field: FormFieldDef) => {
      updateDoc({ fields: { ...readStoredDocument(documentId).fields, [field.id]: field } });
    },
    [documentId, updateDoc],
  );

  const handleRemoveField = useCallback(
    (id: string) => {
      const current = readStoredDocument(documentId);
      const rest = { ...current.fields };
      delete rest[id];
      updateDoc({ fields: rest, template: removeFieldFromTemplate(current.template, id) });
    },
    [documentId, updateDoc],
  );

  // When a block is inserted, missing example data is added; existing values stay untouched.
  const handleBlockInserted = (block: DocumentBlock) => {
    const current = parseJsonObject(readStoredDocument(documentId).json);
    if (!current.ok) {
      setNotice(`“${block.title}” inserted. Example data was not added because the JSON is invalid.`);
      return;
    }
    const { merged, added } = mergeMissing(current.value, block.exampleData ?? {});
    if (added.length > 0) updateDoc({ json: formatJson(merged) });
    setNotice(
      added.length > 0
        ? `“${block.title}” inserted. Example data added: ${added.join(", ")}.`
        : `“${block.title}” inserted. All required data was already present.`,
    );
  };

  const handleReset = () => {
    if (!window.confirm("Reset the template, JSON data, page layout, images, form fields and name to their initial state?")) return;
    clearStoredDocument(documentId);
    setNotice(null);
  };

  // --- PDF comparison (only on button press) -------------------------------------------
  const currentSignature = JSON.stringify([doc.title, doc.template, doc.json, doc.settings, Object.keys(doc.assets), doc.fields]);

  const comparePdf = async () => {
    if (!parsed.ok) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPdf({ status: "loading" });
    setTab("pdf");
    const startedAt = performance.now();

    try {
      // Only server call: template, JSON data, page layout, images and form fields go to the route handler.
      const blob = await fetchPdf(
        "/api/generate-pdf",
        {
          template: doc.template,
          data: parsed.value,
          title: doc.title,
          kind: config.kind,
          settings: doc.settings,
          assets: doc.assets,
          fields: doc.fields,
        },
        { signal: controller.signal },
      );
      const url = URL.createObjectURL(blob);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdf({
        status: "ready",
        url,
        filename: `${doc.title || "document"}.pdf`,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        durationMs: Math.round(performance.now() - startedAt),
        generatedAt: new Date().toLocaleTimeString("en-GB"),
        signature: currentSignature,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPdf({
        status: "error",
        message: error instanceof TypeError ? "The PDF route is not reachable." : error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <div className="flex flex-wrap items-center gap-3 border-b bg-background px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{config.label}</h1>
          <p className="text-xs text-muted-foreground">
            The preview renders locally in the browser. The PDF is only generated via “Compare PDF”.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={parsed.ok ? "secondary" : "destructive"}>{parsed.ok ? "JSON valid" : "JSON invalid"}</Badge>
          <Button onClick={comparePdf} disabled={!parsed.ok || pdf.status === "loading"}>
            {pdf.status === "loading" ? <LoaderCircle className="animate-spin" /> : <FileText />}
            Compare PDF
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-2">
        <section className="grid content-start gap-4 p-4 " aria-label="Editing">

          <Card>
            <CardHeader>
              <CardTitle>Template settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`${documentId}-title`}>Document name (PDF title and file name)</Label>
                <Input
                  id={`${documentId}-title`}
                  value={doc.title}
                  onChange={(event) => updateDoc({ title: event.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Format: A4 portrait · Stylesheet: styles/document.css · Page margins, header/footer and images see below
              </p>
              <details className="rounded-lg border bg-muted/30">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  Template source (unprocessed Handlebars HTML)
                </summary>
                <Textarea
                  readOnly
                  value={doc.template}
                  spellCheck={false}
                  aria-label="Template source"
                  className="field-sizing-fixed h-64 resize-y rounded-none border-0 border-t bg-transparent font-mono text-xs leading-5"
                />
              </details>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw /> Reset to initial state
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template (Lexical)</CardTitle>
              <CardDescription>
                Edit text, headings and lists directly. Insert variables, loops and blocks via the toolbar; the values
                live separately in the JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <LexicalEditor
                html={doc.template}
                onChange={handleTemplateChange}
                variables={variables}
                loops={loops}
                assets={doc.assets}
                onAddAsset={handleAddAsset}
                fields={doc.fields}
                onSaveField={handleSaveField}
                onEditField={setEditingFieldId}
                onBlockInserted={handleBlockInserted}
              />
              {notice && (
                <p role="status" className="text-xs text-muted-foreground">
                  {notice}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Page layout</CardTitle>
              <CardDescription>
                Page margins, header and footer (text with placeholders and/or an image) and page number. The preview
                shows it on every sheet; in the PDF it lives in the same HTML.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PageSettingsPanel settings={doc.settings} assets={doc.assets} onChange={handleSettingsChange} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form fields</CardTitle>
              <CardDescription>
                Fillable PDF fields (AcroForm): text field, date, checkbox, radio group, dropdown, list box,
                signature and button. Insert them into the text via the toolbar; position and size come from the
                layout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormFieldsPanel
                fields={doc.fields}
                template={doc.template}
                onEdit={setEditingFieldId}
                onRemove={handleRemoveField}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
              <CardDescription>
                SVG, PNG and JPG. Insert into the text via the toolbar; pick them in the header/footer above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageLibrary
                assets={doc.assets}
                template={doc.template}
                settings={doc.settings}
                onAdd={handleAddAsset}
                onRemove={handleRemoveAsset}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data (JSON)</CardTitle>
              <CardDescription>
                All variable values. Changes appear in the preview immediately; invalid JSON blocks the PDF
                comparison.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JsonDataEditor
                value={doc.json}
                onChange={handleJsonChange}
                error={parsed.ok ? null : parsed.error}
                onReset={() => handleJsonChange(defaultDocument(documentId).json)}
                heightClassName="h-96"
              />
            </CardContent>
          </Card>
        </section>

        <section className="flex min-h-[36rem] flex-col border-t lg:min-h-0 lg:border-l lg:border-t-0" aria-label="Output">
          <Tabs value={tab} onValueChange={(value) => setTab(value as PanelTab)} className="h-full min-h-0 gap-0">
            <div className="border-b px-3 py-2">
              <TabsList>
                <TabsTrigger value="preview">Live HTML preview</TabsTrigger>
                <TabsTrigger value="pdf">PDF comparison</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="preview" keepMounted className="min-h-0 flex-1">
              <A4IFramePreview
                htmlTemplate={doc.template}
                data={lastValid}
                kind={config.kind}
                title={doc.title}
                settings={doc.settings}
                assets={doc.assets}
                fields={doc.fields}
              />
            </TabsContent>
            <TabsContent value="pdf" keepMounted className="min-h-0 flex-1">
              <PdfComparisonPanel state={pdf} currentSignature={currentSignature} />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <FormFieldDialog
        field={editingFieldId !== null && Object.hasOwn(doc.fields, editingFieldId) ? doc.fields[editingFieldId] : null}
        fields={doc.fields}
        onSave={handleSaveField}
        onClose={() => setEditingFieldId(null)}
      />
    </div>
  );
}

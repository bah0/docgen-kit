"use client";

import { formatJson, parseJsonObject, type DocumentBlock, type JsonObject } from "docgen-kit";
import Link from "next/link";
import { useMemo, useState } from "react";

import { JsonDataEditor } from "@/components/editor/JsonDataEditor";
import { A4IFramePreview } from "@/components/preview/A4IFramePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoBlocks as documentBlocks } from "@/lib/blocks";
import { insertBlockIntoStoredDocument } from "@/lib/document-store";
import { documentConfigs, documentList, type DocumentId } from "@/lib/document-templates";
import { cn } from "@/lib/utils";

interface InsertStatus {
  target: DocumentId;
  blockTitle: string;
  addedPaths: string[];
  dataSkipped: boolean;
}

// Block library: every block is an UNPROCESSED Handlebars template. The preview renders it
// locally with the block's (editable) JSON data; the original markup is always what gets inserted.
export function BlockLibrary() {
  const [selectedId, setSelectedId] = useState(documentBlocks[0].id);
  const [jsonByBlock, setJsonByBlock] = useState<Record<string, string>>({});
  const [validByBlock, setValidByBlock] = useState<Record<string, JsonObject>>({});
  const [target, setTarget] = useState<DocumentId>("invoice");
  const [status, setStatus] = useState<InsertStatus | null>(null);

  const block = documentBlocks.find((candidate) => candidate.id === selectedId) as DocumentBlock;
  const json = jsonByBlock[block.id] ?? formatJson(block.exampleData ?? {});
  const parsed = useMemo(() => parseJsonObject(json), [json]);

  // With invalid JSON the preview stays on the last valid state.
  if (parsed.ok && validByBlock[block.id] !== parsed.value) {
    setValidByBlock((current) => ({ ...current, [block.id]: parsed.value }));
  }
  const previewData = parsed.ok ? parsed.value : (validByBlock[block.id] ?? block.exampleData ?? {});

  const insert = () => {
    if (!parsed.ok) return;
    const { addedPaths, dataSkipped } = insertBlockIntoStoredDocument(target, block, parsed.value);
    setStatus({ target, blockTitle: block.title, addedPaths, dataSkipped });
  };

  const selectBlock = (id: string) => {
    setSelectedId(id);
    setStatus(null);
  };

  return (
    <div className="mx-auto grid w-full max-w-[110rem] gap-4 p-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <nav aria-label="Blocks" className="grid content-start gap-2">
        <h1 className="text-base font-semibold">Block library</h1>
        <p className="text-xs text-muted-foreground">
          Reusable Handlebars building blocks. The markup stays unprocessed; it is only rendered together with JSON data.
        </p>
        {documentBlocks.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => selectBlock(candidate.id)}
            aria-current={candidate.id === block.id}
            className={cn(
              "grid gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted",
              candidate.id === block.id && "border-primary ring-1 ring-primary",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{candidate.title}</span>
              <Badge variant="secondary">{candidate.category}</Badge>
            </span>
            <span className="text-xs text-muted-foreground">{candidate.description}</span>
          </button>
        ))}
      </nav>

      <div className="grid min-w-0 content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{block.title}</CardTitle>
            <CardDescription>{block.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Target document:</span>
              <div role="group" aria-label="Target document" className="flex gap-1">
                {documentList.map((document) => (
                  <Button
                    key={document.id}
                    type="button"
                    size="sm"
                    variant={target === document.id ? "default" : "outline"}
                    aria-pressed={target === document.id}
                    onClick={() => setTarget(document.id)}
                  >
                    {document.label}
                  </Button>
                ))}
              </div>
              <Button type="button" size="sm" onClick={insert} disabled={!parsed.ok} className="ml-auto">
                Insert into {documentConfigs[target].label}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The block is appended to the end of the template as original markup (with {"{{#each}}"} etc.). Missing
              example data is added to the target&apos;s JSON; existing values are kept.
            </p>
            {!parsed.ok && (
              <p role="alert" className="text-xs text-destructive">
                Inserting is disabled while the block&apos;s JSON data is invalid.
              </p>
            )}
            {status && (
              <p role="status" className="text-sm">
                “{status.blockTitle}” was inserted into {documentConfigs[status.target].label}.{" "}
                {status.dataSkipped
                  ? "The target's JSON is invalid; example data was not added. "
                  : status.addedPaths.length > 0
                    ? `Added data: ${status.addedPaths.join(", ")}. `
                    : "All required data was already present. "}
                <Link href={documentConfigs[status.target].path} className="font-medium underline underline-offset-4">
                  Open editor
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="grid min-w-0 content-start gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Handlebars markup</CardTitle>
                <CardDescription>Unprocessed; this is exactly what ends up in the editor.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5">
                  {block.markup}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Block JSON data</CardTitle>
                <CardDescription>Editing updates the preview immediately, without a server call.</CardDescription>
              </CardHeader>
              <CardContent>
                <JsonDataEditor
                  value={json}
                  onChange={(text) => setJsonByBlock((current) => ({ ...current, [block.id]: text }))}
                  error={parsed.ok ? null : parsed.error}
                  onReset={() =>
                    setJsonByBlock((current) => ({ ...current, [block.id]: formatJson(block.exampleData ?? {}) }))
                  }
                  heightClassName="h-64"
                />
              </CardContent>
            </Card>
          </div>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>Rendered client-side with the same helpers and styles as the PDF.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <A4IFramePreview
                  htmlTemplate={block.markup}
                  data={previewData}
                  kind="block"
                  title={block.title}
                  variant="compact"
                  style={{ height: "auto", minHeight: 192, overflowX: "hidden" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Download, FileText, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PdfState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      url: string;
      filename: string;
      sizeKb: number;
      durationMs: number;
      generatedAt: string;
      // Template + JSON at the time of generation; if the current state differs, the PDF is outdated.
      signature: string;
    };

export function PdfComparisonPanel({ state, currentSignature }: { state: PdfState; currentSignature: string }) {
  if (state.status === "idle") {
    return (
      <Placeholder icon={<FileText className="size-8" />} title="No PDF generated yet">
        “Compare PDF” sends the template and JSON once to the route <code>/api/generate-pdf</code>. Gotenberg
        renders the result with Chromium. The live preview is independent of it.
      </Placeholder>
    );
  }

  if (state.status === "loading") {
    return <Placeholder icon={<FileText className="size-8 animate-pulse" />} title="Generating PDF …" />;
  }

  if (state.status === "error") {
    return (
      <Placeholder icon={<TriangleAlert className="size-8 text-destructive" />} title="The PDF could not be generated">
        <span role="alert">{state.message}</span>
      </Placeholder>
    );
  }

  const stale = state.signature !== currentSignature;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <span>
          Generated at {state.generatedAt} · {state.sizeKb} KB · {state.durationMs} ms
        </span>
        {stale && <Badge variant="destructive">outdated – template or JSON has changed</Badge>}
        <a
          href={state.url}
          download={state.filename}
          className={cn(buttonVariants({ variant: "outline", size: "xs" }), "ml-auto")}
        >
          <Download /> Download
        </a>
      </div>
      <embed src={state.url} type="application/pdf" className="min-h-0 w-full flex-1" title="PDF comparison" />
    </div>
  );
}

function Placeholder({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      {children && <p className="max-w-md">{children}</p>}
    </div>
  );
}

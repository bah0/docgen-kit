# Guide: docgen-kit with Express and React

This guide builds a small app from scratch: an **Express** backend that renders PDFs and a **React** (Vite) frontend with a live preview, a Lexical template editor, images and fillable form fields. Everything shown here uses only the public API of `docgen-kit`; the [`demo/`](../demo) folder is a bigger Next.js example of the same pieces.

All data in the examples is fictional.

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Backend: Express](#2-backend-express)
3. [Frontend: React live preview and PDF download](#3-frontend-react-live-preview-and-pdf-download)
4. [Page layout, header, footer and images](#4-page-layout-header-footer-and-images)
5. [Template editor (Lexical)](#5-template-editor-lexical)
6. [Fillable form fields](#6-fillable-form-fields)
7. [Persisting the document in the browser](#7-persisting-the-document-in-the-browser)
8. [Next.js notes](#8-nextjs-notes)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- Node.js 20 or newer
- Docker, for [Gotenberg](https://gotenberg.dev) (the headless Chromium that turns HTML into PDF)

Start Gotenberg. Because templates are editable input, disable JavaScript and block private network ranges:

```bash
docker run --rm -p 3011:3000 gotenberg/gotenberg:8 gotenberg \
  --chromium-disable-javascript=true \
  --chromium-deny-private-ips=true
```

Check it with `curl http://localhost:3011/health`.

---

## 2. Backend: Express

```bash
mkdir api && cd api
npm init -y
npm install express docgen-kit pdf-lib
```

`pdf-lib` is an optional peer dependency. You only need it when documents contain form fields; without it the service answers such requests with a clear error.

`server.mjs` (ESM; use `import` or `"type": "module"` in `package.json`):

```js
import express from "express";
import { createGotenbergRenderer, createPdfService, PdfRenderError } from "docgen-kit/server";

const service = createPdfService({
  renderer: createGotenbergRenderer({ url: process.env.GOTENBERG_URL ?? "http://localhost:3011" }),
});

const app = express();
// Images are inlined as Base64, so allow a larger body than Express' 100 kB default.
app.use(express.json({ limit: "12mb" }));

app.post("/api/pdf", async (req, res, next) => {
  try {
    // parse() validates the untrusted body (limits, ids, sizes) and throws PdfRenderError(400) if invalid.
    const { pdf, filename } = await service.generate(service.parse(req.body));

    res
      .type("application/pdf")
      .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .set("Cache-Control", "no-store")
      .send(Buffer.from(pdf));
  } catch (error) {
    // 400 invalid input, 422 template error, 502/503/504 Gotenberg problems, 500 form-field problems.
    if (error instanceof PdfRenderError) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.listen(3001, () => console.log("PDF API on http://localhost:3001"));
```

CommonJS projects can use `const { createPdfService } = require("docgen-kit/server")`; the package ships both formats.

Try it:

```bash
node server.mjs

curl -X POST http://localhost:3001/api/pdf \
  -H "Content-Type: application/json" \
  -d '{"template":"<h1>Invoice {{no}}</h1><p>Total: {{money total}}</p>","data":{"no":"INV-1","total":1234.5},"title":"Invoice"}' \
  -o invoice.pdf
```

### Production checklist

| Topic | Recommendation |
| --- | --- |
| Authentication | `/api/pdf` renders arbitrary templates. Put your normal auth and rate limiting in front of it. |
| CORS | Only needed if the frontend runs on another origin. Use the `cors` package with an explicit origin; do not use `*` with credentials. |
| Content type | Keep clients on `application/json`. The Fetch handler of the library enforces this; in Express `express.json()` already ignores other types. |
| Limits | Keep `express.json({ limit })` and your reverse proxy limit in line (default of the library handler: 12 MB). |
| Gotenberg | Do not expose it publicly. Run it on the same private network as the API. |

### Locale, currency and custom helpers

```js
import { createTemplateEngine } from "docgen-kit";

const engine = createTemplateEngine({
  locale: "de-AT",
  currency: "EUR",
  helpers: { upper: (value) => String(value).toUpperCase() },
});

const service = createPdfService({ renderer, engine, language: "de" });
```

Use the **same engine** in the React preview (section 3) so both render identical HTML.

### Other PDF engines

`createGotenbergRenderer` is just one implementation of a one-method interface:

```js
const renderer = {
  async render(html) {
    // convert html -> PDF bytes with Puppeteer, Playwright, a hosted API, ...
    return new Uint8Array(/* ... */);
  },
};
const service = createPdfService({ renderer });
```

---

## 3. Frontend: React live preview and PDF download

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install docgen-kit
```

Forward API calls to Express during development, `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
});
```

`src/App.tsx`:

```tsx
import { useState } from "react";
import { emptySettings, type DocumentInput } from "docgen-kit";
import { fetchPdf } from "docgen-kit/client";
import { DocumentPreview } from "docgen-kit/react";

const initial: DocumentInput = {
  template: `
    <h1>Invoice {{invoice.no}}</h1>
    <p>Dear {{customer.name}},</p>
    <table class="doc-table">
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th></tr></thead>
      <tbody>
        {{#each items}}
        <tr><td>{{description}}</td><td class="num">{{quantity}}</td><td class="num">{{money price}}</td></tr>
        {{/each}}
      </tbody>
    </table>
    <p><strong>Total: {{money (sumProduct items "quantity" "price")}}</strong></p>`,
  data: {
    invoice: { no: "INV-2026-0001" },
    customer: { name: "Jane Roe" },
    items: [
      { description: "Consulting (hrs)", quantity: 8, price: 95 },
      { description: "Hosting (month)", quantity: 1, price: 40 },
    ],
  },
  title: "Invoice",
  kind: "invoice",
  settings: emptySettings(),
};

export default function App() {
  const [doc, setDoc] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    try {
      const blob = await fetchPdf("/api/pdf", doc); // rejects with the server's error message
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank"); // or: <a href={url} download="invoice.pdf">
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100vh" }}>
      <textarea
        value={JSON.stringify(doc.data, null, 2)}
        onChange={(e) => {
          try {
            setDoc({ ...doc, data: JSON.parse(e.target.value) });
          } catch {
            /* keep the last valid data while the JSON is incomplete */
          }
        }}
        style={{ font: "13px monospace", padding: 12 }}
      />
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
        <div style={{ padding: 8 }}>
          <button onClick={download}>Download PDF</button> {error && <span style={{ color: "crimson" }}>{error}</span>}
        </div>
        <DocumentPreview {...doc} />
      </div>
    </div>
  );
}
```

What happens:

- `DocumentPreview` compiles Handlebars **in the browser**, so typing updates the preview immediately, without a server call. The document is shown in a sandboxed iframe and split into real A4 sheets with the same break rules as the PDF.
- `fetchPdf` posts the same `DocumentInput` to your Express route. Only the PDF button talks to the server.
- On a template error (a half-typed `{{#each`) the preview keeps the last valid state. To show the error, use the `header` render prop:

```tsx
<DocumentPreview
  {...doc}
  header={({ error, pageCount }) => (
    <p style={{ fontSize: 12 }}>
      {pageCount} page(s) {error && <strong style={{ color: "crimson" }}>Template error: {error}</strong>}
    </p>
  )}
/>
```

`DocumentPreview` fills its parent (`height: 100%`) and scrolls. Pass `style` / `className` to adjust it. Use `variant="compact"` for a continuous strip without pages (useful for snippets).

---

## 4. Page layout, header, footer and images

`settings` controls margins (mm), header/footer (left/center/right) and the page number. Texts may contain Handlebars placeholders and are rendered with your data.

```tsx
import { emptySettings } from "docgen-kit";

const settings = emptySettings();
settings.margins = { top: 25, right: 15, bottom: 20, left: 15 };
settings.footer.left.text = "{{company.name}} · {{company.city}}";
settings.pageNumber = "bottom-right"; // "none" | "bottom-right" | "bottom-center" -> "1/3"
```

Images are stored in `assets` and referenced by id. `createImageAsset` (browser only) downsizes PNG/JPG and sanitises SVG:

```tsx
import { createImageAsset } from "docgen-kit/client";

async function addLogo(file: File) {
  const asset = await createImageAsset(file); // { id, name, mime, dataUri, width, height }
  setDoc((current) => {
    const settings = structuredClone(current.settings ?? emptySettings());
    settings.header.left.imageId = asset.id; // logo in the header
    settings.header.left.imageHeightMm = 12;
    return { ...current, assets: { ...current.assets, [asset.id]: asset }, settings };
  });
}

// In the text:
// <img src="asset:IMAGE_ID" style="width: 40mm">
```

```tsx
<input type="file" accept="image/svg+xml,image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && addLogo(e.target.files[0])} />
```

In the PDF the header, footer and page number are CSS page margin boxes inside the same HTML; the preview draws the same fields on every sheet.

---

## 5. Template editor (Lexical)

The `react` entry point provides everything between Lexical and the template string: nodes for **template blocks**, **images** and **form fields**, HTML import/export and a plugin that keeps editor and string in sync. You provide the toolbar.

```bash
npm install lexical @lexical/react @lexical/rich-text @lexical/list @lexical/utils
```

```tsx
import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode } from "@lexical/rich-text";
import type { AssetMap, FieldMap } from "docgen-kit";
import {
  $importTemplateHtml,
  AssetsContext,
  FormFieldsContext,
  TemplateHtmlPlugin,
  templateNodes,
} from "docgen-kit/react";
import { useState } from "react";

interface Props {
  template: string;
  onChange: (template: string) => void;
  assets: AssetMap;
  fields: FieldMap;
}

export function TemplateEditor({ template, onChange, assets, fields }: Props) {
  const [initial] = useState(template); // read once; later changes go through TemplateHtmlPlugin

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "template-editor",
        nodes: [HeadingNode, ListNode, ListItemNode, ...templateNodes],
        editorState: (editor) => $importTemplateHtml(editor, initial),
        onError: console.error,
      }}
    >
      <AssetsContext.Provider value={assets}>
        <FormFieldsContext.Provider value={{ fields, onSaveField: () => {}, onEditField: () => {} }}>
          <RichTextPlugin
            contentEditable={<ContentEditable aria-label="Template" style={{ minHeight: 240, padding: 12, outline: "none" }} />}
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TemplateHtmlPlugin html={template} onChange={onChange} />
        </FormFieldsContext.Provider>
      </AssetsContext.Provider>
    </LexicalComposer>
  );
}
```

Use it next to the preview:

```tsx
<TemplateEditor template={doc.template} onChange={(template) => setDoc((d) => ({ ...d, template }))} assets={doc.assets ?? {}} fields={doc.fields ?? {}} />
<DocumentPreview {...doc} />
```

`onChange` delivers the **unprocessed** template with `{{placeholders}}`. Typing `{{customer.name}}` in the editor is enough; the values stay in `data`. If you change `template` from outside (a reset button, a block inserted elsewhere), `TemplateHtmlPlugin` imports it back into the editor without creating an undo step.

### Inserting blocks

Blocks are reusable Handlebars snippets (tables with `{{#each}}`, signature lines, ...). They appear as one node in the editor and survive import/export unchanged. Presets are exported as `documentBlocks`:

```tsx
import { documentBlocks, getBlockById } from "docgen-kit";
import { $createTemplateBlockNode } from "docgen-kit/react";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import { $insertNodeToNearestRoot } from "@lexical/utils";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

function InsertBlockButton({ blockId }: { blockId: string }) {
  const [editor] = useLexicalComposerContext(); // must render inside <LexicalComposer>
  const block = getBlockById(blockId)!;

  return (
    <button
      onClick={() =>
        editor.update(() => {
          const node = $createTemplateBlockNode(block.id, block.title, block.markup);
          if ($isRangeSelection($getSelection())) $insertNodeToNearestRoot(node);
          else $getRoot().append(node);
        })
      }
    >
      {block.title}
    </button>
  );
}
```

The presets expect the data shapes documented by their markup (e.g. `items[].quantity`, `items[].unitPrice`) and the styles of the default stylesheet. Add your own blocks with `wrapTemplateBlock({ id, label }, markup)`.

### Changing how the nodes look

The nodes handle selection, deletion and persistence. Their appearance comes from *views* that you can replace, for example with your design system:

```tsx
import { NodeViewsProvider, type ImageViewProps } from "docgen-kit/react";

function MyImageView({ asset, widthMm, selected, onSelect, onRemove }: ImageViewProps) {
  return (
    <span onClick={(e) => onSelect(e.shiftKey)} className={selected ? "ring" : ""}>
      {asset ? <img src={asset.dataUri} style={{ width: `${widthMm}mm` }} alt="" /> : "missing"}
      {selected && <button onClick={onRemove}>Remove</button>}
    </span>
  );
}

<NodeViewsProvider views={{ Image: MyImageView }}>{/* editor */}</NodeViewsProvider>
```

Views exist for `TemplateBlock`, `Image` and `FormField`. The defaults are unstyled and dependency-free.

---

## 6. Fillable form fields

Form fields are boxes of fixed size in the text. In the PDF the server turns each box into a real AcroForm field at exactly that position, so you never maintain coordinates.

Supported types: `text`, `textarea`, `date`, `checkbox`, `radio`, `dropdown`, `listbox`, `signature`, `button`.

Add a field by creating its definition and placing a placeholder in the template:

```tsx
import { createFormField, fieldPlaceholder } from "docgen-kit";

const field = createFormField("text", doc.fields ?? {}); // unique id and default name ("text_1")
field.name = "full_name";
field.defaultValue = "{{customer.name}}"; // placeholders are allowed
field.widthMm = 70;
field.required = true;

setDoc((d) => ({
  ...d,
  fields: { ...d.fields, [field.id]: field },
  template: d.template + `<p>Name: ${fieldPlaceholder(field.id)}</p>`,
}));
```

Inside the Lexical editor insert the node instead of editing the string:

```tsx
import { $createFormFieldNode } from "docgen-kit/react";

editor.update(() => {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) selection.insertNodes([$createFormFieldNode(field.id)]);
});
```

Wire `onEditField` of `FormFieldsContext` to your own properties dialog; the node's view calls it on double-click. The definition is a plain object (`FormFieldDef`): size, options, required, read-only, font size, alignment, max length, button action, and so on.

Notes:

- The same field placed twice gets a numeric suffix in the PDF (`full_name_2`).
- Field texts use Helvetica (WinAnsi). Characters outside it become `?`.
- Signature fields can be placed and filled in Acrobat and similar viewers, not in Chrome's built-in viewer.
- The preview shows placeholder boxes; the real fields exist only in the PDF.
- The server needs `pdf-lib` installed (section 2).

---

## 7. Persisting the document in the browser

For editors that should survive a reload, `createDocumentStore` wraps `localStorage` (with an in-memory fallback if storage is blocked) and fits React's `useSyncExternalStore`:

```tsx
import { useMemo, useSyncExternalStore } from "react";
import { emptySettings } from "docgen-kit";
import { createDocumentStore, type StoredDocument } from "docgen-kit/client";

const defaults = (): StoredDocument => ({
  title: "Invoice",
  template: "<h1>Hello {{name}}</h1>",
  json: '{ "name": "Jane" }', // data is stored as text so invalid JSON is not lost while typing
  settings: emptySettings(),
  assets: {},
  fields: {},
});

export const store = createDocumentStore<"invoice">({ keyPrefix: "my-app:doc:", defaults });

export function useStoredDocument(id: "invoice") {
  const raw = useSyncExternalStore(
    (callback) => store.subscribe(id, callback),
    () => store.readRaw(id),
    () => null, // server snapshot: nothing is stored on the server
  );
  return useMemo(() => store.parse(raw, id) ?? defaults(), [raw, id]);
}

// store.update("invoice", { template }) merges into the freshly stored state.
// store.insertBlock("invoice", block) appends a block and merges missing example data into the JSON.
```

The store notifies subscribers in the same tab and listens to `storage` events from other tabs.

---

## 8. Next.js notes

- `docgen-kit/react` keeps its `"use client"` directive, so you can import it from server components; everything that uses hooks must still live in your own client components.
- Use the library's Fetch handler as a route handler (no Express needed):

  ```ts
  // app/api/pdf/route.ts
  import { createGotenbergRenderer, createPdfRequestHandler, createPdfService } from "docgen-kit/server";

  const service = createPdfService({ renderer: createGotenbergRenderer({ url: process.env.GOTENBERG_URL || undefined }) });
  export const POST = createPdfRequestHandler(service);
  ```
- Reading `localStorage` must happen after hydration. The [demo](../demo/components/editor/DocumentWorkbench.tsx) shows a simple mounted gate.

---

## 9. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Gotenberg is not reachable at ...` (503) | The container is not running or `GOTENBERG_URL` is wrong. Check `curl <url>/health`. |
| `Template error: Parse error ...` (422) | Invalid Handlebars, e.g. an unclosed `{{#each}}`. The preview shows the same message through `status.error`. |
| `Form fields need the optional dependency "pdf-lib"` (500) | Run `npm install pdf-lib` in the backend. |
| `The request is too large.` (413) | Images are inlined as Base64. Raise `express.json({ limit })` and `createPdfRequestHandler(service, { maxBodyChars })` together. |
| The preview shows everything on one tall sheet | The preview stylesheet is missing. If you pass a custom `css`, keep the `.sheet`, `.pages` and `@media screen` rules of `docgen-kit/styles.css`. |
| Preview and PDF differ slightly | Fonts. Chromium in Gotenberg uses its own fonts; the default stylesheet uses Arial/Liberation Sans so metrics match. Install your fonts in the Gotenberg image if you use others. |
| Numbers or dates look unexpected | The default engine uses `en-GB` and `GBP`. Create an engine with your `locale` and `currency` and pass it to the service **and** the preview. |

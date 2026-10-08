# AI Task: Full-Stack ERP Document Generator & Template Engine (Next.js App Router + Gotenberg + Lexical + Handlebars + Shadcn UI)

## Context & Goal

Build a fully functional reference implementation for an ERP-style document engine with dynamic layouting, a custom client-side WYSIWYG editor, instant live preview, and high-fidelity PDF generation.

The rendering pipeline leverages Chrome/Chromium as the single source of truth across both frontend and backend:

* **Frontend Live Preview:** HTML/CSS rendered inside an A4-styled `<iframe>` with 0ms latency using client-side Handlebars compilation.

* **Backend PDF Generation:** Gotenberg (Dockerized Headless Chromium) receiving HTML/CSS via API and returning pixel-perfect PDFs.

## Technical Stack & Dependencies

* **Framework:** Next.js 15/16+ (App Router, TypeScript, Tailwind CSS).

* **UI Components:** Shadcn UI (Dialog, Button, Tabs, Card, Input, Textarea, Tooltip).

* **Editor:** `@lexical/react` (or Lexical core) configured to output clean HTML/Inline CSS and Handlebars placeholders.

* **Template Engine:** `handlebars` (instantiated in client-side React components for live preview and in the single PDF API Route for PDF generation).

* **PDF Processor:** Gotenberg v8 running via Docker Compose; map host port `3011` to container port `3000` and configure the app with `GOTENBERG_URL=http://localhost:3011`.

* **HTTP Client:** Native `fetch` or `axios` with `form-data` support for Gotenberg.

* **Ports:** Next.js runs on port `3010`; Gotenberg is reachable from the host on port `3011`.

* **Dynamic Data:** Keep variable document values in JSON, separate from the Handlebars template. Provide an editable JSON editor for the invoice, employment contract, and block previews.

## Core Requirements & Specifications

### 1. Handling "Paged" vs. "Flow" & Visual Page Breaks

Demonstrate clearly how page-breaks and dynamic flow work in both the Frontend iFrame Preview and the Backend Gotenberg PDF generation.

#### A. CSS Paging Mechanics

Include a base Print stylesheet (`styles/document.css`) containing:

```
@page {
  size: A4 portrait;
  margin: 20mm 15mm 20mm 15mm;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* Page Break Helpers */
.page-break-before {
  page-break-before: always;
  break-before: page;
}

.page-break-after {
  page-break-after: always;
  break-after: page;
}

.avoid-break {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Repeating Headers for Dynamic Flow Tables */
table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  display: table-header-group; /* Repeats table header across pages in PDF */
}

tfoot {
  display: table-footer-group;
}

tr {
  page-break-inside: avoid;
}

```

#### B. Visual Page-Breaks in Frontend `<iframe>`

Show how the iFrame simulates physical A4 pages visually (e.g., using a multi-page wrapper, CSS page-height indicators, or CSS `@media screen` styling) so the user can visually anticipate page splits while editing with Lexical.

#### C. Flowing Employment Contract

Provide a separate employee service-contract template as a flowing document. Let paragraphs, clauses, and optional sections flow naturally across A4 pages; do not construct the contract from fixed page containers. Contract and employee values must come from its editable JSON data. The sample is illustrative and must not claim legal advice or jurisdiction-specific compliance.

### 2. JSON-Driven Variables and Handlebars Block Library

* All dynamic or variable document values belong in JSON data, separate from the HTML template. Include an editable JSON editor for the invoice, employment contract, and each block preview.

* Derive available Handlebars variable paths from the JSON keys. The editor must support inserting scalar variables such as `{{customer.name}}` and array loops such as `{{#each items}}...{{/each}}`.

* Provide a separate block-library page with reusable Handlebars templates, including invoice rows and a dynamic inventory table with name, quantity, unit price, and calculated total price.

* Inserting a block adds its unrendered Handlebars markup to the selected editor, not static rendered rows. Preserve its Handlebars syntax through Lexical editing and HTML import/export. Add required example data without overwriting existing values.

* Render JSON and template edits locally in the iframe without calling an API, Server Action, or Gotenberg. Invalid JSON must be reported and must not be used for PDF comparison.

### 2. Required Project Structure & Deliverables

Please construct the complete code for the following file structure:

```
├── app/
│   ├── api/
│   │   └── generate-pdf/
│   │       └── route.ts         # Route Handler sending compiled HTML to Gotenberg
│   ├── blocks/
│   │   └── page.tsx             # Handlebars block library and JSON preview
│   ├── editor/
│   │   ├── page.tsx             # Invoice editor with JSON data and live preview
│   │   └── employment-contract/
│   │       └── page.tsx         # Flowing employee service-contract template
│   └── layout.tsx
├── components/
│   ├── editor/
│   │   ├── LexicalEditor.tsx    # Lexical Rich-Text Editor emitting HTML
│   │   ├── Toolbar.tsx          # Variable, loop, and block insertion controls
│   │   ├── JsonDataEditor.tsx   # Editable JSON data and validation
│   │   └── TemplateBlockNode.tsx # Preserves Handlebars blocks in Lexical
│   ├── preview/
│   │   └── A4IFramePreview.tsx  # Dynamic iFrame with Client-side Handlebars compile
│   ├── blocks/
│   │   └── BlockLibrary.tsx     # Block selection, JSON data, and live preview
│   └── ui/                      # Shadcn UI Primitives
├── lib/
│   ├── gotenberg.ts             # Gotenberg Client Service (Multipart/Form-Data API call)
│   ├── handlebars.ts            # Shared Handlebars helpers and compiler setup
│   ├── document-blocks.ts       # Reusable Handlebars block definitions
│   └── mock-data.ts             # Separate JSON data for invoice, contract, and blocks
├── styles/
│   └── document.css             # Unified Print & Preview CSS Rules
└── docker-compose.yml           # Docker setup for Gotenberg service

```

## Detailed Step-by-Step Guidance

### Step 1: Lexical HTML Output Integration

* Build `LexicalEditor.tsx` with rich text capabilities (Bold, Italic, Headings, Lists, Custom HTML Nodes if needed).

* Provide a toolbar with quick-action controls to insert JSON-derived Handlebars variables and array loops (e.g. `{{customer.name}}`, `{{#each items}}...{{/each}}`).

* Expose an `onChange` callback returning a raw HTML string.

* Preserve inserted Handlebars block markup through Lexical editing and HTML import/export.

### Step 2: Instant A4 iFrame Preview (`A4IFramePreview.tsx`)

* Accept `htmlTemplate: string` and `data: Record<string, any>` as props.

* Compile the Handlebars template locally in React (`useMemo`). JSON edits must update the preview immediately without a server request.

* Inject the result into an `<iframe>` using the `srcDoc` attribute along with `styles/document.css`.

* Apply base styles so that the iFrame canvas visually looks like an A4 document (`210mm` x `297mm`, shadow, margin simulation).

### Step 3: Gotenberg Service & API Route (`app/api/generate-pdf/route.ts`)

* Implement the single PDF route handler that receives the final HTML template and JSON data. Do not add a redundant Server Action.

* Use `handlebars` on the server to inject data into the template.

* Build a `FormData` request payload targeting Gotenberg (`${GOTENBERG_URL}/forms/chromium/convert/html`, defaulting to `http://localhost:3011`).

* Include `files` (`index.html` containing the compiled HTML and document CSS).

* Return the binary PDF stream (`application/pdf`) back to the client.

### Step 4: UI/UX Layout (`app/editor/page.tsx`)

* Responsive split screen using Shadcn UI:

  * **Left Panel (50%):** Lexical Editor + Template Settings + editable JSON Data Editor. Keep template markup and variable values separate.

  * **Right Panel (50%):** Tabbed interface switching between:

    1. **Live HTML Preview** (Instant iFrame rendering).

    2. **PDF Comparison** (Actual PDF stream from Gotenberg inside `<embed>` or blob preview, generated only on explicit request).

  * Top Action bar with a "PDF vergleichen" button triggering the single backend route. The PDF is for conformance comparison with the live HTML preview, not part of the live-rendering path.

### Step 5: Block Library (`app/blocks/page.tsx`)

* Provide reusable, code-defined Handlebars blocks for invoice rows and inventory items. The inventory example includes name, quantity, unit price, and calculated total.

* Show each block's editable JSON data and a client-rendered live preview. Allow choosing a target document and inserting the original, unrendered Handlebars markup into its editor.

### Step 6: Flowing Employee Service Contract (`app/editor/employment-contract/page.tsx`)

* Provide a separate editor using the same Lexical, JSON editor, local A4 iframe preview, and explicit PDF comparison workflow as the invoice.

* Use variable employee and contract data, flowing paragraphs/clauses, and optional sections. Keep the sample clearly illustrative and not legal advice.

## Instructions for Output

* Provide all files complete and runnable with no missing imports or placeholders.

* Include clear inline comments explaining how page breaks work in CSS and how the HTML string travels from Lexical -> Handlebars -> iFrame / Gotenberg.

* Include a valid `docker-compose.yml` file snippet for launching Gotenberg with host port `3011` mapped to container port `3000`; configure Next.js to use port `3010`.

* Use only the API Route for PDF generation. Live preview and editing must remain client-side; call the route only for an explicit PDF comparison.
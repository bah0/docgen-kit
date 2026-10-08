# Dev notes: paper formats and landscape

Internal notes for whoever implements the roadmap items "other paper formats" and "landscape" (a future session, a contributor). Status today: **A4 portrait only**, hard-coded in the places listed below. Keep the change small; do not add per-page or mixed formats.

## Goal

```ts
settings.page = { size: "A4" | "A3" | "A5" | "B5" | "Letter" | "Legal" | "Tabloid", orientation: "portrait" | "landscape" };
```

- Default and fallback for old stored documents: `{ size: "A4", orientation: "portrait" }`.
- Optional later: `size: { widthMm, heightMm }` for custom sizes.
- Single source of truth: one table of sizes in mm (`PAGE_SIZES`) and one helper `resolvePageSize(settings.page) -> { widthMm, heightMm }` (landscape swaps width and height). Use only its result everywhere.

## Where A4 is hard-coded today

Line numbers are approximate; search for `A4`, `210mm`, `297mm`, `page-content-` to find them again.

| File | What | Change |
| --- | --- | --- |
| `src/styles/document.css` ~26 | `@page { size: A4 portrait; }` | Remove `size` here; emit it from `pageDecorToCss`. Keep a fallback so a stylesheet-only user still gets A4. |
| `src/styles/document.css` ~403-404 | `--page-content-width/height: calc(210mm - …)` / `297mm` | Use new CSS variables `--page-width` / `--page-height`, set per document through `marginVariablesCss`. |
| `src/styles/document.css` ~422, ~464-465 | `.sheet { width: 210mm; height: 297mm }` and a `210mm` width in the preview layout | `var(--page-width)` / `var(--page-height)`. |
| `src/styles/document.css` header comment (lines ~9-20) | Prose with 297mm / 257mm / 210mm / 180mm | Wording only. |
| `src/core/document-html.ts` | `A4_WIDTH_PX = 794`, `PREVIEW_GUTTER_PX` | Replace by a helper `pageSizePx(settings)`; update `DocumentPreview`. |
| `src/react/DocumentPreview.tsx` | `A4_HEIGHT_PX`, `A4_WIDTH_PX` for the iframe size and scaling | Derive width/height from `settings.page`; reword "A4 sheets" to "sheets". |
| `src/core/page-decor.ts` | `pageDecorToCss` emits `@page { margin: … }`; `marginVariablesCss` emits the preview variables | Add `size: <w>mm <h>mm` (explicit mm, no keyword/orientation parsing differences) and the new variables. |
| `src/core/page-settings.ts` | `DocumentSettings`, `emptySettings`, `parseSettings`, limits | Add `page`; sanitise in `parseSettings` (unknown size -> A4, unknown orientation -> portrait); old documents stay valid. |
| `src/server/gotenberg.ts` | Comment only; `preferCssPageSize=true` already makes Gotenberg honour `@page size` | No code change expected. |
| `src/client/paginate.ts` | Header comment says A4; the logic is size-agnostic (uses the flow's own column width) | Verify only. |
| `demo/components/editor/PageSettingsPanel.tsx` | Margin inputs | Add selects "Format" and "Orientation" at the top. |
| `demo/components/editor/DocumentWorkbench.tsx` (~264) | Text "Format: A4 portrait" | Make dynamic or remove. |
| `demo/components/preview/A4IFramePreview.tsx` | Info line "A4 · n pages" | Show the selected format; consider renaming the wrapper. |

Limits to recheck: `MARGIN_LIMITS` (0-60 mm) must be clamped against the chosen size (A5 landscape is 148 × 210 mm) so the content area never becomes <= 0.

## Sizes (mm, portrait)

| Name | Width × height |
| --- | --- |
| A3 | 297 × 420 |
| A4 | 210 × 297 |
| A5 | 148 × 210 |
| B5 (ISO) | 176 × 250 |
| Letter | 215.9 × 279.4 |
| Legal | 215.9 × 355.6 |
| Tabloid | 279.4 × 431.8 |

## Preview pitfalls

- The preview lays the flow out in CSS columns exactly as wide as the PDF content area and clips one column per sheet (`paginate.ts`). The sheet's content size must equal the PDF's, otherwise page breaks drift. 1 mm = 3.7795 px (96 dpi); round only for the iframe size.
- `DocumentPreview` scales the iframe to the container width (`scale = min(1, containerWidth / frameWidth)`); landscape sheets are wider, so the zoom drops sooner.
- Sheet screenshots: tall formats (A3, Tabloid) need a taller viewport. Clip a normal page screenshot to the sheet's bounding box; an element screenshot inside the scaled iframe can miss the footer.
- Test a table across two or more pages in every format (`repeatTableHeaders`).

## Tests to add

1. `test/page-settings.test.ts`: `parseSettings` defaults to A4 portrait, accepts every known size, rejects unknown values, clamps margins.
2. `test/render.test.ts`: `renderDocument` for Letter and landscape contains the expected `@page { size: … }` and preview variables.
3. Visual comparison of the live preview and the Gotenberg PDF, page by page, for A4, Letter and A4 landscape (see the workflow below). Every row must break at the same place.

## Regression workflow used so far

1. `npm run build -w demo`, then `npx next start <abs path>/demo -p 3012` (a production build avoids the dev overlay).
2. `playwright-core` with the system Chrome (viewport 1600 × 1000, device scale 2) opens the pages, clicks "Compare PDF", saves the PDF from the blob URL and screenshots each `.sheet` of the preview iframe.
3. `pdftoppm -r 110 -png` renders the PDF pages; an HTML page with both images side by side goes through Gotenberg to produce `docs/comparison.pdf`.
4. The scripts lived in `/tmp/shots` (`run.mjs`, `compose.mjs`) and are not in the repo. Recreate them from this description or add them to `demo/scripts/` with an npm script.

## Definition of done

- `npm run check`, `npm run lint -w demo` and `npm run build -w demo` pass; the new tests are green.
- README: remove the two format items from the roadmap and replace the "Page format" section with the supported list; update `docs/guide-express-react.md` (section 4) and the `DocumentWorkbench` text.
- Old stored documents without `settings.page` still render as A4 portrait.

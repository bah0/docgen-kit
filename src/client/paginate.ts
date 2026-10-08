// Builds real A4 sheets from the preview's column flow.
//
// Chromium fragments content into columns by the same rules as for printing (break-inside,
// orphans/widows, forced breaks). styles/document.css therefore lays the flow out in columns as
// large as the content area of a PDF page. Here each column is shown as its own sheet:
// one copy of the flow per page, shifted left and clipped at the sheet.
// This makes breaks, margins and spacing match the PDF.

type ColumnOf = (element: Element) => number;

// Chromium repeats <thead> only when printing, not in columns. Therefore a copy of the header rows
// sits at the start of each following page of a table (with a forced column break before it). Column by
// column from left to right, because each copy pushes the rows behind it down.
function repeatTableHeaders(flow: HTMLElement, columnOf: ColumnOf, columnCount: () => number): void {
  const tables = Array.from(flow.querySelectorAll("table")).filter((table) => (table.tHead?.rows.length ?? 0) > 0);

  for (let column = 1; column < columnCount(); column += 1) {
    for (const table of tables) {
      const head = table.tHead as HTMLTableSectionElement;
      // If a browser repeats the header in columns itself, do not insert a duplicate.
      if (head.getClientRects().length > 1) continue;

      const rows = Array.from(table.tBodies)
        .flatMap((tbody) => Array.from(tbody.rows))
        .filter((row) => !row.classList.contains("repeat-head"));
      const first = rows.find((row) => columnOf(row) === column);
      if (!first || first === rows[0]) continue;

      Array.from(head.rows).forEach((headRow, index) => {
        const copy = headRow.cloneNode(true) as HTMLTableRowElement;
        copy.classList.add("repeat-head");
        if (index === 0) copy.classList.add("repeat-head-first");
        first.before(copy);
      });
    }
  }
}

// Returns the page count; 0 if there was nothing to do (compact preview or already paginated).
export function paginateDocument(doc: Document): number {
  const { body } = doc;
  const view = doc.defaultView;
  const flow = doc.querySelector<HTMLElement>("main.document");
  if (!view || !flow || body.classList.contains("is-compact") || body.classList.contains("is-paginated")) return 0;

  try {
    const box = flow.getBoundingClientRect();
    const stride = box.width + (parseFloat(view.getComputedStyle(flow).columnGap) || 0);
    const columnOf: ColumnOf = (element) =>
      Math.max(0, Math.floor((element.getBoundingClientRect().left - box.left + 0.5) / stride));
    // Overflowing columns sit to the right of the container and extend its scrollWidth.
    const columnCount = () => Math.max(1, Math.round((flow.scrollWidth - box.width) / stride) + 1);

    repeatTableHeaders(flow, columnOf, columnCount);

    const count = columnCount();
    const copies = Array.from({ length: count }, (_, index) =>
      index === 0 ? flow : (flow.cloneNode(true) as HTMLElement),
    );
    // Header/footer including page number (lib/page-decor.ts); only present if the HTML brings them.
    const decor = doc.querySelector<HTMLTemplateElement>("template#page-decor");

    const pages = doc.createElement("div");
    pages.className = "pages";
    copies.forEach((copy, index) => {
      copy.style.marginLeft = `${-index * stride}px`;
      if (index > 0) copy.setAttribute("aria-hidden", "true");

      const sheetBody = doc.createElement("div");
      sheetBody.className = "sheet-body";
      sheetBody.append(copy);

      const sheet = doc.createElement("div");
      sheet.className = "sheet";
      sheet.dataset.label = `Page ${index + 1} of ${count}`;
      sheet.append(sheetBody);
      if (decor) {
        sheet.append(decor.content.cloneNode(true));
        sheet.querySelectorAll(".page-number").forEach((element) => {
          element.textContent = `${index + 1}/${count}`;
        });
      }
      pages.append(sheet);
    });
    body.append(pages);
    return count;
  } finally {
    // Make the flow visible again even on an error (see visibility in document.css).
    body.classList.add("is-paginated");
  }
}

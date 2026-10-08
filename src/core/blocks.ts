import type { JsonObject } from "./json-data";
import { wrapTemplateBlock } from "./template-markers";

// Reusable Handlebars building blocks. `markup` is ALWAYS the unprocessed template
// (with {{#each}}, {{...}} etc.); rendering only happens in the preview or the PDF.

export type BlockCategory = "Invoice" | "Inventory" | "Layout" | "Contract";

export interface DocumentBlock {
  id: string;
  title: string;
  description: string;
  category: BlockCategory;
  markup: string;
  // Data the markup relies on; supplied by the application (see `withExampleData` in the demo).
  exampleData?: JsonObject;
}

export const documentBlocks: DocumentBlock[] = [
  {
    id: "invoice-header",
    title: "Letterhead and address field",
    description: "Sender, recipient address and invoice details in one block.",
    category: "Invoice",
    markup: `<div class="letterhead avoid-break">
  <div class="brand">{{company.name}}</div>
  <div class="contact">
    {{company.street}}<br>
    {{company.zip}} {{company.city}}<br>
    {{company.email}}<br>
    VAT ID: {{company.vatId}}
  </div>
</div>
<div class="address-grid avoid-break">
  <div class="address">
    <div class="return-line">{{company.name}} · {{company.street}} · {{company.zip}} {{company.city}}</div>
    <strong>{{customer.name}}</strong><br>
    {{customer.contact}}<br>
    {{customer.street}}<br>
    {{customer.zip}} {{customer.city}}
  </div>
  <table class="meta-table">
    <tbody>
      <tr><th>Invoice no.</th><td>{{invoice.number}}</td></tr>
      <tr><th>Date</th><td>{{date invoice.date}}</td></tr>
      <tr><th>Due date</th><td>{{date invoice.dueDate}}</td></tr>
      <tr><th>Customer no.</th><td>{{customer.id}}</td></tr>
    </tbody>
  </table>
</div>`,
  },
  {
    id: "invoice-rows",
    title: "Invoice line items",
    description: "Table with {{#each items}}: item, description, quantity, unit price and calculated line total.",
    category: "Invoice",
    markup: `<table class="doc-table">
  <thead>
    <tr>
      <th class="col-pos">No.</th>
      <th>Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{inc @index}}</td>
      <td>{{description}}{{#if details}}<br><span class="muted small">{{details}}</span>{{/if}}</td>
      <td class="num">{{quantity}}</td>
      <td class="num">{{money unitPrice}}</td>
      <td class="num">{{money (multiply quantity unitPrice)}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
  },
  {
    id: "invoice-totals",
    title: "Totals block",
    description: "Net, VAT and gross from the line items (helpers sumProduct, percent, add).",
    category: "Invoice",
    markup: `<table class="totals avoid-break">
  <tbody>
    <tr><td>Net amount</td><td class="num">{{money (sumProduct items "quantity" "unitPrice")}}</td></tr>
    <tr><td>VAT {{invoice.vatRate}} %</td><td class="num">{{money (percent (sumProduct items "quantity" "unitPrice") invoice.vatRate)}}</td></tr>
    <tr class="grand"><td>Total amount</td><td class="num">{{money (add (sumProduct items "quantity" "unitPrice") (percent (sumProduct items "quantity" "unitPrice") invoice.vatRate))}}</td></tr>
  </tbody>
</table>`,
  },
  {
    id: "inventory-table",
    title: "Dynamic inventory table",
    description: "Name, quantity, unit price and calculated total per item, plus a total row.",
    category: "Inventory",
    markup: `<table class="doc-table inventory-table">
  <thead>
    <tr>
      <th>Item</th>
      <th class="num">Quantity</th>
      <th class="num">Unit price</th>
      <th class="num">Total price</th>
    </tr>
  </thead>
  <tbody>
    {{#each inventory}}
    <tr>
      <td>{{name}}</td>
      <td class="num">{{quantity}}</td>
      <td class="num">{{money unitPrice}}</td>
      <td class="num">{{money (multiply quantity unitPrice)}}</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="3">Total</td>
      <td class="num">{{money (sumProduct inventory "quantity" "unitPrice")}}</td>
    </tr>
  </tfoot>
</table>`,
  },
  {
    id: "terms-list",
    title: "Terms (list)",
    description: "Numbered sections from an array; each section stays together (avoid-break).",
    category: "Invoice",
    markup: `{{#each terms}}
<section class="avoid-break">
  <h3>{{inc @index}}. {{title}}</h3>
  <p>{{text}}</p>
</section>
{{/each}}`,
  },
  {
    id: "page-break",
    title: "Hard page break",
    description: "Everything after it starts on a new page in the PDF (CSS class page-break-before).",
    category: "Layout",
    markup: `<div class="page-break-before"></div>`,
  },
  {
    id: "doc-note",
    title: "Note box",
    description: "Highlighted paragraph that is not split across pages.",
    category: "Layout",
    markup: `<div class="doc-note avoid-break">{{note.text}}</div>`,
  },
  {
    id: "signature-block",
    title: "Signature block",
    description: "Two signature lines that always stay together on one page.",
    category: "Contract",
    markup: `<div class="signature-grid avoid-break">
  <div>
    <div class="small muted">{{signature.place}}, {{date signature.date}}</div>
    <div class="signature-line">{{signature.leftLabel}}</div>
  </div>
  <div>
    <div class="small muted">{{signature.place}}, {{date signature.date}}</div>
    <div class="signature-line">{{signature.rightLabel}}</div>
  </div>
</div>`,
  },
  {
    id: "bullet-list",
    title: "Bullet list from array",
    description: "List items via {{#each duties}}; count and text come from the JSON.",
    category: "Contract",
    markup: `<ul>
  {{#each duties}}
  <li>{{this}}</li>
  {{/each}}
</ul>`,
  },
  {
    id: "additional-clauses",
    title: "Additional clauses",
    description: "Heading plus paragraphs per entry; flows naturally across pages.",
    category: "Contract",
    markup: `{{#each additionalClauses}}
<h2>{{title}}</h2>
{{#each paragraphs}}
<p>{{this}}</p>
{{/each}}
{{/each}}`,
  },
  {
    id: "optional-section",
    title: "Optional section",
    description: "Only output when probation.enabled is true in the JSON.",
    category: "Contract",
    markup: `{{#if probation.enabled}}
<h2>Probationary period</h2>
<p>The first {{probation.months}} months are a probationary period.</p>
{{/if}}`,
  },
];

export function getBlockById(id: string): DocumentBlock | undefined {
  return documentBlocks.find((block) => block.id === id);
}

// Empty block for custom HTML/Handlebars; no example data is added.
export const customBlock: DocumentBlock = {
  id: "custom",
  title: "Custom HTML / Handlebars block",
  description: "Empty block whose markup is edited directly in the editor.",
  category: "Layout",
  markup: `<div class="doc-note">\n  Custom markup, e.g. {{customer.name}}\n</div>`,
};

// Ready-made template string snippet (with markers) for places where no editor is open.
export function blockToTemplateString(block: DocumentBlock): string {
  return wrapTemplateBlock({ id: block.id, label: block.title }, block.markup);
}

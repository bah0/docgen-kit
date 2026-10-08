import { emptySettings, formatJson, wrapTemplateBlock, type DocumentBlock, type DocumentSettings } from "docgen-kit";

import { getDemoBlock } from "@/lib/blocks";
import { employmentContractData, invoiceData } from "@/lib/mock-data";

// Starting templates of the two editors. They contain ONLY markup and placeholders;
// all values come from the JSON file (lib/mock-data.ts).

export type DocumentId = "invoice" | "employment-contract";
export type DocumentKind = "invoice" | "contract" | "block";

export interface DocumentConfig {
  id: DocumentId;
  kind: DocumentKind;
  label: string;
  path: string;
  defaultTitle: string;
  defaultTemplate: string;
  defaultJson: string;
  defaultSettings: DocumentSettings;
}

function block(id: string): string {
  const found = getDemoBlock(id) as DocumentBlock;
  return wrapTemplateBlock({ id: found.id, label: found.title }, found.markup);
}

// Like block(), but with custom markup (e.g. variables adapted to the contract).
function customBlock(id: string, label: string, markup: string): string {
  return wrapTemplateBlock({ id, label }, markup);
}

// Plain text, headings and simple lists live as Lexical nodes.
// Anything with tables, loops over table rows or CSS classes lives in template blocks.
const invoiceTemplate = [
  block("invoice-header"),
  "<h1>Invoice {{invoice.number}}</h1>",
  "<p>Dear Sir or Madam,</p>",
  "<p>Thank you for your order “{{invoice.reference}}”. We invoice the services provided as follows:</p>",
  block("invoice-rows"),
  block("invoice-totals"),
  "<p>Please transfer the total amount within {{invoice.paymentTermsDays}} days ({{invoice.paymentTerms}}) to the following account:</p>",
  "<p><strong>IBAN:</strong> {{company.iban}}<br><strong>BIC:</strong> {{company.bic}}</p>",
  "<p>Kind regards<br>{{company.name}}</p>",
  block("page-break"),
  "<h2>Appendix: General terms (example)</h2>",
  "<p>Because of a hard page break, this appendix always starts on a new page.</p>",
  block("terms-list"),
].join("\n");

const contractTemplate = [
  "<h1>{{contract.title}}</h1>",
  customBlock("doc-note", "Note box", '<div class="doc-note avoid-break">{{contract.disclaimer}}</div>'),
  "<p>made on {{date contract.date}} between</p>",
  "<p><strong>{{employer.name}}</strong>, {{employer.street}}, {{employer.zip}} {{employer.city}}, represented by {{employer.representative}} (the “Employer”),</p>",
  "<p>and</p>",
  "<p><strong>{{employee.firstName}} {{employee.lastName}}</strong>, born on {{date employee.birthDate}}, residing at {{employee.street}}, {{employee.zip}} {{employee.city}} (the “Employee”).</p>",
  "<h2>Start and term</h2>",
  "<p>Employment starts on {{date contract.startDate}} and is concluded for an indefinite period.</p>",
  "{{#if probation.enabled}}",
  "<p>The first {{probation.months}} months of employment are a probationary period. During the probationary period either party may terminate employment at any time.</p>",
  "{{/if}}",
  "<h2>Duties</h2>",
  "<p>The Employee is employed as <strong>{{contract.jobTitle}}</strong> in the {{contract.department}} department. The duties include in particular:</p>",
  block("bullet-list"),
  "<p>Within reason, the Employer may also assign other comparable duties to the Employee.</p>",
  "<h2>Place of work</h2>",
  "<p>The place of work is {{contract.workplace}}.</p>",
  "{{#if remoteWork.enabled}}",
  "<p>The Employee may work from home up to {{remoteWork.daysPerWeek}} days per week. The Employer provides the equipment required for this; details are governed by a separate agreement.</p>",
  "{{/if}}",
  "<h2>Working hours</h2>",
  "<p>The regular weekly working time is {{number contract.weeklyHours 1}} hours. The timing and distribution of working hours are agreed jointly within operational possibilities.</p>",
  "<h2>Remuneration</h2>",
  "<p>The gross monthly salary is <strong>{{money contract.monthlySalary}}</strong>, paid {{contract.salaryPayments}} times a year. The salary covers the agreed duties within regular working hours.</p>",
  "<h2>Annual leave</h2>",
  "<p>The Employee is entitled to {{contract.vacationDays}} working days of annual leave per year of employment. The timing is agreed by mutual consent, taking operational requirements into account.</p>",
  "<h2>Confidentiality and data protection</h2>",
  "<p>The Employee undertakes to keep the Employer's business and trade secrets, as well as those of its customers, confidential. This obligation continues after employment ends.</p>",
  "<p>Personal data may only be processed within the scope of the Employee's duties and in line with the internal data protection policies.</p>",
  "{{#if nonCompete.enabled}}",
  "<h2>Non-compete clause</h2>",
  "<p>For {{nonCompete.months}} months after employment ends, the Employee undertakes not to work for a directly competing company.</p>",
  "{{/if}}",
  block("additional-clauses"),
  "<h2>Termination</h2>",
  "<p>Employment may be terminated subject to the agreed notice period of {{contract.noticePeriod}}.</p>",
  block("signature-block"),
].join("\n");

// Starting page layout: default margins, one line of text at the left of the footer and a page number.
function withFooter(text: string, pageNumber: DocumentSettings["pageNumber"]): DocumentSettings {
  const settings = emptySettings();
  settings.footer.left.text = text;
  settings.pageNumber = pageNumber;
  return settings;
}

export const documentConfigs: Record<DocumentId, DocumentConfig> = {
  invoice: {
    id: "invoice",
    kind: "invoice",
    label: "Invoice",
    path: "/editor",
    defaultTitle: "Invoice",
    defaultTemplate: invoiceTemplate,
    defaultJson: formatJson(invoiceData),
    defaultSettings: withFooter(
      "{{company.name}} · {{company.street}}, {{company.zip}} {{company.city}} · VAT ID {{company.vatId}}",
      "bottom-right",
    ),
  },
  "employment-contract": {
    id: "employment-contract",
    kind: "contract",
    label: "Employment contract",
    path: "/editor/employment-contract",
    defaultTitle: "Employment Agreement",
    defaultTemplate: contractTemplate,
    defaultJson: formatJson(employmentContractData),
    defaultSettings: withFooter("{{contract.title}} · {{employee.firstName}} {{employee.lastName}}", "bottom-center"),
  },
};

export const documentList: DocumentConfig[] = Object.values(documentConfigs);

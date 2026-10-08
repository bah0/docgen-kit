import type { JsonObject } from "docgen-kit";

// Variable values live only here (as JSON) and never in the HTML template.
// The editors show these objects as editable JSON text.
//
// All names, companies, addresses and numbers are fictional sample data.

const company = {
  name: "Acme Software Ltd",
  street: "1 Example Street",
  zip: "AB1 2CD",
  city: "Sampletown",
  email: "accounts@acme-software.example",
  vatId: "GB000000000",
  iban: "GB82 WEST 1234 5698 7654 32",
  bic: "EXMPGB2L",
};

const customer = {
  id: "C-20418",
  name: "Example Manufacturing plc",
  contact: "Mr John Doe",
  street: "12 Placeholder Road",
  zip: "XY9 8ZW",
  city: "Demoville",
};

function item(description: string, quantity: number, unitPrice: number, details?: string) {
  return details ? { description, details, quantity, unitPrice } : { description, quantity, unitPrice };
}

// 26 line items: enough for the table to flow across several A4 pages
// and for the table header to repeat on follow-up pages in the PDF.
const invoiceItems = [
  item("Project management (hrs)", 24, 98, "Kick-off, steering, status reports"),
  item("Requirements analysis (hrs)", 16, 92),
  item("Functional specification and process model (hrs)", 32, 92, "Workshops with business departments"),
  item("UX concept and wireframes (hrs)", 20, 88),
  item("Database design (hrs)", 14, 95),
  item("Backend development: order management (hrs)", 60, 95, "Quotes, orders, delivery notes"),
  item("Backend development: warehouse management (hrs)", 48, 95, "Stock levels, batches, stocktaking"),
  item("Accounting interface (hrs)", 22, 95),
  item("Frontend development: dashboard (hrs)", 36, 90),
  item("Frontend development: reports (hrs)", 28, 90),
  item("PDF document templates (hrs)", 18, 90, "Invoice, delivery note, contract"),
  item("Roles and permissions concept (hrs)", 12, 95),
  item("Legacy system data migration (hrs)", 26, 92),
  item("Test automation (hrs)", 30, 88),
  item("Manual acceptance testing (hrs)", 20, 78),
  item("Performance optimisation (hrs)", 10, 100),
  item("Security review (hrs)", 8, 120),
  item("Documentation (hrs)", 14, 75),
  item("Key user training (day)", 2, 880),
  item("Administrator training (day)", 1, 880),
  item("Cloud hosting setup (flat fee)", 1, 640),
  item("Monitoring and alerting (flat fee)", 1, 420),
  item("Reporting module licence (year)", 1, 1290),
  item("Document generator licence (year)", 1, 1890),
  item("Hypercare after go-live (hrs)", 16, 98),
  item("Travel expenses (flat fee)", 1, 350),
];

const invoiceMeta = {
  number: "INV-2026-0142",
  date: "2026-10-08",
  dueDate: "2026-10-22",
  reference: "Process digitisation, phase 1",
  vatRate: 20,
  paymentTermsDays: 14,
  paymentTerms: "payable without deduction",
};

const terms = [
  {
    title: "Scope",
    text: "These sample terms apply to all services under this invoice. They only serve to illustrate page breaks.",
  },
  {
    title: "Payment",
    text: "Invoices are payable within the stated period without deduction. Late payments may incur interest at a reasonable rate.",
  },
  {
    title: "Retention of title",
    text: "Delivered goods remain the property of the supplier until paid in full.",
  },
  {
    title: "Jurisdiction",
    text: "Disputes are subject to the courts at the supplier's registered office, to the extent permitted by law.",
  },
];

export const invoiceData: JsonObject = {
  company,
  customer,
  invoice: invoiceMeta,
  items: invoiceItems,
  terms,
};

const additionalClauses = [
  {
    title: "Other employment",
    paragraphs: [
      "The employee must notify the employer in writing in advance of any other employment that could affect the employer's interests.",
      "The employer will review the notification and reply within a reasonable time.",
    ],
  },
  {
    title: "Equipment and confidentiality of credentials",
    paragraphs: [
      "For the duration of employment the employee is provided with the necessary equipment. It remains the property of the employer and must be returned when employment ends.",
      "Access credentials and keys must be kept safe and must not be shared with third parties.",
      "The loss of equipment or any suspected misuse must be reported without delay.",
    ],
  },
  {
    title: "Final provisions",
    paragraphs: [
      "Amendments and additions to this agreement must be made in writing. This also applies to any change to this written-form clause.",
      "Should any provision of this sample text be invalid, the remaining content is not affected.",
    ],
  },
];

const contractSignature = {
  place: "Sampletown",
  date: "2026-10-08",
  leftLabel: "Acme Software Ltd (Employer)",
  rightLabel: "Jane Roe (Employee)",
};

const duties = [
  "Development and maintenance of the ERP modules for order and warehouse management",
  "Contributing to the architecture of the document and reporting platform",
  "Code reviews and maintenance of the automated tests",
  "Aligning requirements with business departments and customers",
  "Documenting the implemented solutions",
];

export const employmentContractData: JsonObject = {
  contract: {
    title: "Employment Agreement",
    disclaimer:
      "Illustrative sample document to demonstrate the document flow. It is not legal advice and has not been checked against the requirements of any particular jurisdiction.",
    date: "2026-10-08",
    startDate: "2026-11-02",
    jobTitle: "Software Developer",
    department: "Product Development",
    workplace: "Sampletown, Example Street office",
    weeklyHours: 37.5,
    monthlySalary: 3650,
    salaryPayments: 12,
    vacationDays: 25,
    noticePeriod: "one month, effective at the end of a calendar month",
  },
  employer: {
    name: "Acme Software Ltd",
    street: "1 Example Street",
    zip: "AB1 2CD",
    city: "Sampletown",
    representative: "Alex Sample (Managing Director)",
  },
  employee: {
    firstName: "Jane",
    lastName: "Roe",
    birthDate: "1993-04-17",
    street: "7 Sample Lane, Flat 12",
    zip: "AB2 3EF",
    city: "Sampletown",
  },
  // Optional sections: toggle true/false and the pages reflow.
  probation: { enabled: true, months: 3 },
  remoteWork: { enabled: true, daysPerWeek: 2 },
  nonCompete: { enabled: false, months: 6 },
  duties,
  additionalClauses,
  signature: contractSignature,
};

// Example data per block (key = block id from lib/document-blocks.ts).
// It is merged into the document JSON without overwriting existing values.
export const blockExampleData: Record<string, JsonObject> = {
  "invoice-header": { company, customer, invoice: invoiceMeta },
  "invoice-rows": { items: invoiceItems.slice(0, 4) },
  "invoice-totals": {
    items: invoiceItems.slice(0, 4),
    invoice: { vatRate: 20 },
  },
  "inventory-table": {
    inventory: [
      { name: "Screws M6 x 30 (pack of 100)", quantity: 24, unitPrice: 4.9 },
      { name: "Hex nuts M6 (pack of 100)", quantity: 18, unitPrice: 3.2 },
      { name: "Washers M6 (pack of 250)", quantity: 12, unitPrice: 2.75 },
      { name: "Threaded rod M6, 1 m", quantity: 40, unitPrice: 1.85 },
      { name: "Cable ties 200 mm (pack of 100)", quantity: 30, unitPrice: 2.4 },
    ],
  },
  "terms-list": { terms },
  "page-break": {},
  "doc-note": { note: { text: "Note: This paragraph is set as a highlighted box." } },
  "bullet-list": { duties: duties.slice(0, 3) },
  "additional-clauses": { additionalClauses: additionalClauses.slice(0, 2) },
  "optional-section": { probation: { enabled: true, months: 3 } },
  "signature-block": { signature: contractSignature },
};

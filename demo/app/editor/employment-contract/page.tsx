import type { Metadata } from "next";

import { DocumentWorkbench } from "@/components/editor/DocumentWorkbench";

export const metadata: Metadata = { title: "Employment contract – ERP Document Generator" };

// Flowing document: no fixed page containers, paragraphs and clauses run across A4 pages.
export default function EmploymentContractPage() {
  return <DocumentWorkbench documentId="employment-contract" />;
}

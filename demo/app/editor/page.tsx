import type { Metadata } from "next";

import { DocumentWorkbench } from "@/components/editor/DocumentWorkbench";

export const metadata: Metadata = { title: "Invoice – ERP Document Generator" };

export default function InvoiceEditorPage() {
  return <DocumentWorkbench documentId="invoice" />;
}

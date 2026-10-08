import type { Metadata } from "next";

import { BlockLibrary } from "@/components/blocks/BlockLibrary";

export const metadata: Metadata = { title: "Block library – ERP Document Generator" };

export default function BlocksPage() {
  return <BlockLibrary />;
}

import { customBlock, documentBlocks, type DocumentBlock } from "docgen-kit";

import { blockExampleData } from "@/lib/mock-data";

// The library ships the block markup; the example data that makes a block render is demo content.

export const demoBlocks: DocumentBlock[] = documentBlocks.map((block) => ({
  ...block,
  exampleData: blockExampleData[block.id] ?? {},
}));

export const demoCustomBlock: DocumentBlock = { ...customBlock, exampleData: {} };

export function getDemoBlock(id: string): DocumentBlock | undefined {
  return demoBlocks.find((block) => block.id === id);
}

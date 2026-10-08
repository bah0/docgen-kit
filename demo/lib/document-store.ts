import { createDocumentStore, type StoredDocument } from "docgen-kit/client";

import { documentConfigs, type DocumentId } from "@/lib/document-templates";

// The editors and the block library share their state via localStorage (see createDocumentStore).
// The key prefix stays the same as before the library split, so existing browser data keeps working.

export type { StoredDocument };

export function defaultDocument(id: DocumentId): StoredDocument {
  const config = documentConfigs[id];
  return {
    title: config.defaultTitle,
    template: config.defaultTemplate,
    json: config.defaultJson,
    settings: config.defaultSettings,
    assets: {},
    fields: {},
  };
}

export const documentStore = createDocumentStore<DocumentId>({
  keyPrefix: "pdf-gen:document:",
  defaults: defaultDocument,
});

export const parseStoredDocument = documentStore.parse;
export const readStoredDocument = documentStore.read;
export const readStoredDocumentRaw = documentStore.readRaw;
export const subscribeToDocument = documentStore.subscribe;
export const writeStoredDocument = documentStore.write;
export const clearStoredDocument = documentStore.clear;
export const insertBlockIntoStoredDocument = documentStore.insertBlock;

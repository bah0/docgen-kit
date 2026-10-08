import { blockToTemplateString, type DocumentBlock } from "../core/blocks";
import { parseAssets, type AssetMap } from "../core/assets";
import { parseFormFields, type FieldMap } from "../core/form-fields";
import { formatJson, mergeMissing, parseJsonObject, type JsonObject } from "../core/json-data";
import { parseSettings, type DocumentSettings } from "../core/page-settings";

// Browser persistence for editor state. Several views (editors, a block library, other tabs) can share
// one state via localStorage: every write notifies the subscribers of the same tab, the `storage`
// event covers other tabs. `readRaw` + `subscribe` fit React's useSyncExternalStore.

export interface StoredDocument {
  title: string;
  // Unprocessed Handlebars template (HTML with {{...}}) as exported from Lexical.
  template: string;
  // Variable values as JSON text; kept as text so invalid intermediate states are preserved too.
  json: string;
  // Margins, header/footer and page number.
  settings: DocumentSettings;
  // Uploaded images; the template references them via <img src="asset:ID">.
  assets: AssetMap;
  // Fillable form fields; the template references them via <span data-form-field="ID">.
  fields: FieldMap;
}

export interface InsertBlockResult {
  // Newly added JSON paths; empty if everything was already present.
  addedPaths: string[];
  // true if the target document's JSON was invalid and therefore left unchanged.
  dataSkipped: boolean;
}

export interface DocumentStoreOptions<Id extends string> {
  // Prefix of the localStorage keys. Default: "docgen:document:"
  keyPrefix?: string;
  // State of a document that has not been stored yet (also supplies the default page settings).
  defaults: (id: Id) => StoredDocument;
}

export interface DocumentStore<Id extends string> {
  // Raw JSON string (or null); only changes on actual writes. For useSyncExternalStore.
  readRaw(id: Id): string | null;
  subscribe(id: Id, callback: () => void): () => void;
  parse(raw: string | null, id: Id): StoredDocument | null;
  read(id: Id): StoredDocument;
  write(id: Id, document: StoredDocument): void;
  // Merges a patch into the freshly read state, so concurrent partial updates do not overwrite each other.
  update(id: Id, patch: Partial<StoredDocument>): void;
  clear(id: Id): void;
  // Appends the UNPROCESSED block to the end of the template and adds missing example data to the JSON.
  insertBlock(id: Id, block: DocumentBlock, data?: JsonObject): InsertBlockResult;
}

export function createDocumentStore<Id extends string>({
  keyPrefix = "docgen:document:",
  defaults,
}: DocumentStoreOptions<Id>): DocumentStore<Id> {
  const memory = new Map<Id, string>();
  const listeners = new Set<() => void>();
  // If localStorage is blocked or full, the editor keeps working in memory (without persistence).
  let memoryOnly = false;

  const keyFor = (id: Id) => `${keyPrefix}${id}`;
  const notify = () => {
    for (const listener of listeners) listener();
  };

  // Older states without settings/assets/fields get the document defaults.
  const parse = (raw: string | null, id: Id): StoredDocument | null => {
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== "object" || value === null) return null;
      const { title, template, json, settings, assets, fields } = value as Record<string, unknown>;
      if (typeof title === "string" && typeof template === "string" && typeof json === "string") {
        return {
          title,
          template,
          json,
          settings: parseSettings(settings, defaults(id).settings),
          assets: parseAssets(assets),
          fields: parseFormFields(fields),
        };
      }
    } catch {
      // Corrupted entry: treat as "not present".
    }
    return null;
  };

  const readRaw = (id: Id): string | null => {
    if (typeof window === "undefined") return null;
    if (!memoryOnly) {
      try {
        return window.localStorage.getItem(keyFor(id));
      } catch {
        memoryOnly = true;
      }
    }
    return memory.get(id) ?? null;
  };

  const read = (id: Id): StoredDocument => parse(readRaw(id), id) ?? defaults(id);

  const write = (id: Id, document: StoredDocument): void => {
    const raw = JSON.stringify(document);
    memory.set(id, raw);
    if (!memoryOnly) {
      try {
        window.localStorage.setItem(keyFor(id), raw);
      } catch {
        memoryOnly = true;
      }
    }
    notify();
  };

  return {
    readRaw,
    parse,
    read,
    write,

    subscribe(id, callback) {
      // "storage" only fires in OTHER tabs; writes in the own tab go through `listeners`.
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === keyFor(id)) callback();
      };
      window.addEventListener("storage", onStorage);
      listeners.add(callback);
      return () => {
        window.removeEventListener("storage", onStorage);
        listeners.delete(callback);
      };
    },

    update(id, patch) {
      write(id, { ...read(id), ...patch });
    },

    clear(id) {
      memory.delete(id);
      if (!memoryOnly) {
        try {
          window.localStorage.removeItem(keyFor(id));
        } catch {
          memoryOnly = true;
        }
      }
      notify();
    },

    insertBlock(id, block, data = block.exampleData ?? {}) {
      const current = read(id);
      const template = `${current.template.trimEnd()}\n${blockToTemplateString(block)}\n`;

      let json = current.json;
      let addedPaths: string[] = [];
      let dataSkipped = false;

      const parsed = parseJsonObject(current.json);
      if (parsed.ok) {
        const { merged, added } = mergeMissing(parsed.value, data);
        addedPaths = added;
        if (added.length > 0) json = formatJson(merged);
      } else {
        dataSkipped = true;
      }

      write(id, { ...current, template, json });
      return { addedPaths, dataSkipped };
    },
  };
}

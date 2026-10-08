import { beforeEach, describe, expect, it } from "vitest";

import { createDocumentStore, fetchPdf, type StoredDocument } from "../src/client";
import { emptySettings, type DocumentBlock } from "../src/core";

// Minimal browser globals: the store only needs window.localStorage and the storage event API.
const data = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});

const defaults = (): StoredDocument => ({
  title: "Default",
  template: "<p>Hello</p>",
  json: '{"name":"Jane"}',
  settings: emptySettings(),
  assets: {},
  fields: {},
});

describe("createDocumentStore", () => {
  const store = createDocumentStore<"a" | "b">({ keyPrefix: "test:", defaults });
  beforeEach(() => {
    data.clear();
    store.clear("a");
  });

  it("falls back to the defaults and persists writes", () => {
    expect(store.read("a").title).toBe("Default");
    store.update("a", { title: "Changed" });
    expect(store.read("a").title).toBe("Changed");
    expect(data.has("test:a")).toBe(true);
    expect(store.read("b").title).toBe("Default");
  });

  it("notifies subscribers of the same tab", () => {
    let calls = 0;
    const unsubscribe = store.subscribe("a", () => calls++);
    store.update("a", { title: "x" });
    unsubscribe();
    store.update("a", { title: "y" });
    expect(calls).toBe(1);
  });

  it("ignores corrupted entries", () => {
    data.set("test:a", "{not json");
    expect(store.read("a").title).toBe("Default");
  });

  it("inserts a block and merges missing example data only", () => {
    const block: DocumentBlock = {
      id: "greeting",
      title: "Greeting",
      description: "",
      category: "Layout",
      markup: "<p>{{name}} {{city}}</p>",
      exampleData: { name: "Ignored", city: "Sampletown" },
    };
    const result = store.insertBlock("a", block);
    expect(result).toEqual({ addedPaths: ["city"], dataSkipped: false });
    const stored = store.read("a");
    expect(stored.template).toContain("<!--tpl-block:");
    expect(stored.template).toContain("<p>{{name}} {{city}}</p>");
    expect(JSON.parse(stored.json)).toEqual({ name: "Jane", city: "Sampletown" });
  });

  it("leaves invalid JSON untouched when inserting a block", () => {
    store.update("a", { json: "{broken" });
    const result = store.insertBlock("a", { id: "x", title: "X", description: "", category: "Layout", markup: "<p></p>", exampleData: { a: 1 } });
    expect(result.dataSkipped).toBe(true);
    expect(store.read("a").json).toBe("{broken");
  });
});

describe("fetchPdf", () => {
  const input = { template: "<p></p>", data: {} };

  it("posts JSON and resolves with the PDF blob", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const blob = await fetchPdf("/api/pdf", input, {
      fetch: async (url, init) => {
        seen = { url: String(url), init: init as RequestInit };
        return new Response("%PDF-1.7", { status: 200 });
      },
    });
    expect(seen?.url).toBe("/api/pdf");
    expect(seen?.init.method).toBe("POST");
    expect(JSON.parse(String(seen?.init.body))).toEqual(input);
    expect(await blob.text()).toBe("%PDF-1.7");
  });

  it("rejects with the server's error message", async () => {
    await expect(
      fetchPdf("/api/pdf", input, { fetch: async () => Response.json({ error: "Template error: boom" }, { status: 422 }) }),
    ).rejects.toThrow("Template error: boom");
    await expect(fetchPdf("/api/pdf", input, { fetch: async () => new Response("oops", { status: 500 }) })).rejects.toThrow(
      "status 500",
    );
  });
});

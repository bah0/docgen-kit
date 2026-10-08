import { describe, expect, it } from "vitest";

import { splitTemplateBlocks, wrapTemplateBlock } from "../src/core";

describe("template block markers", () => {
  it("round-trips raw markup between comment markers", () => {
    const markup = '<table>\n  {{#each items}}\n  <tr><td>{{name}}</td></tr>\n  {{/each}}\n</table>';
    const template = `<p>Intro</p>\n${wrapTemplateBlock({ id: "rows", label: "Rows" }, markup)}\n<p>Outro</p>`;

    const segments = splitTemplateBlocks(template);
    expect(segments.map((segment) => segment.type)).toEqual(["html", "block", "html"]);

    const block = segments.find((segment) => segment.type === "block");
    expect(block).toMatchObject({ meta: { id: "rows", label: "Rows" }, markup });
  });

  it("returns a single html segment when there are no blocks", () => {
    expect(splitTemplateBlocks("<p>Plain</p>")).toEqual([{ type: "html", html: "<p>Plain</p>" }]);
  });
});

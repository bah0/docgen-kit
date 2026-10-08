// Template blocks in the HTML string.
//
// Raw Handlebars markup (e.g. <tr> inside {{#each}}) cannot be passed through an
// HTML parser without loss: the parser would push text between
// <table>/<tr> out of the table. Therefore such blocks are wrapped
// in comment markers in the template string:
//
//   <!--tpl-block:{"id":"invoice-rows","label":"Rechnungspositionen"}-->
//   ...unprocessed Handlebars markup...
//   <!--/tpl-block-->
//
// On import into Lexical the string is split at these markers; the content
// moves unchanged into a TemplateBlockNode. On export the same
// string is produced again. Handlebars and the browser treat the comments as text.

export interface TemplateBlockMeta {
  id: string;
  label: string;
}

export type TemplateSegment =
  | { type: "html"; html: string }
  | { type: "block"; meta: TemplateBlockMeta; markup: string };

const BLOCK_PATTERN = /<!--tpl-block:(\{.*?\})-->\r?\n?([\s\S]*?)\r?\n?<!--\/tpl-block-->/g;

const END_MARKER = /<!--\/tpl-block-->/g;

// "-" is escaped so the metadata can never contain "-->" and end the comment.
function encodeMeta(meta: TemplateBlockMeta): string {
  return JSON.stringify(meta).replace(/-/g, "\\u002d");
}

export function wrapTemplateBlock(meta: TemplateBlockMeta, markup: string): string {
  // An accidentally typed end-marker literal would close the block prematurely.
  const safeMarkup = markup.replace(END_MARKER, "<!-- /tpl-block -->");
  return `<!--tpl-block:${encodeMeta(meta)}-->\n${safeMarkup}\n<!--/tpl-block-->`;
}

function parseMeta(json: string): TemplateBlockMeta {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) {
      const { id, label } = parsed as Record<string, unknown>;
      return {
        id: typeof id === "string" ? id : "custom",
        label: typeof label === "string" ? label : "Eigener Block",
      };
    }
  } catch {
    // Broken metadata: the block is preserved anyway.
  }
  return { id: "custom", label: "Eigener Block" };
}

export function splitTemplateBlocks(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;

  for (const match of template.matchAll(BLOCK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: "html", html: template.slice(cursor, start) });
    segments.push({ type: "block", meta: parseMeta(match[1]), markup: match[2] });
    cursor = start + match[0].length;
  }

  if (cursor < template.length) segments.push({ type: "html", html: template.slice(cursor) });
  return segments;
}

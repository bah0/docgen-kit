import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  $createParagraphNode,
  $getRoot,
  $isDecoratorNode,
  $isElementNode,
  type LexicalEditor,
  type LexicalNode,
  type ParagraphNode,
  type RootNode,
} from "lexical";

import { $createTemplateBlockNode, TEMPLATE_BLOCK_ATTRIBUTE } from "./TemplateBlockNode";
import { splitTemplateBlocks, wrapTemplateBlock } from "../core/template-markers";

// Translates between the template string (HTML + Handlebars) and the Lexical state.
//
//   Import: String --splitTemplateBlocks--> HTML segments + raw blocks
//           HTML segment --DOMParser--> $generateNodesFromDOM --> Lexical nodes
//           Block        ---------------------------------------> TemplateBlockNode (markup unchanged)
//   Export: Lexical --$generateHtmlFromNodes--> HTML --clean up--> String
//           TemplateBlockNode placeholder --> comment markers + raw markup

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

// Handlebars statements often sit in the template as a bare line between blocks
// ("{{#if x}}"). Lexical needs a paragraph for them.
function wrapBareText(body: HTMLElement): void {
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue;
    const lines = (child.textContent ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const fragment = body.ownerDocument.createDocumentFragment();
    for (const line of lines) {
      const paragraph = body.ownerDocument.createElement("p");
      paragraph.textContent = line;
      fragment.append(paragraph);
    }
    child.replaceWith(fragment);
  }
}

function $htmlToNodes(editor: LexicalEditor, html: string): LexicalNode[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  wrapBareText(doc.body);
  return $generateNodesFromDOM(editor, doc);
}

// Only block nodes are allowed at root level; loose text/inline nodes are moved into a paragraph.
function $appendTopLevel(root: RootNode, nodes: LexicalNode[]): void {
  let paragraph: ParagraphNode | null = null;
  for (const node of nodes) {
    const isBlock = ($isElementNode(node) || $isDecoratorNode(node)) && !node.isInline();
    if (isBlock) {
      paragraph = null;
      root.append(node);
    } else {
      if (!paragraph) {
        paragraph = $createParagraphNode();
        root.append(paragraph);
      }
      paragraph.append(node);
    }
  }
}

// Must run inside editor.update().
export function $importTemplateHtml(editor: LexicalEditor, template: string): void {
  const root = $getRoot();
  root.clear();

  const nodes: LexicalNode[] = [];
  for (const segment of splitTemplateBlocks(template)) {
    if (segment.type === "block") {
      nodes.push($createTemplateBlockNode(segment.meta.id, segment.meta.label, segment.markup));
    } else {
      nodes.push(...$htmlToNodes(editor, segment.html));
    }
  }

  $appendTopLevel(root, nodes);
  if (root.getChildrenSize() === 0) root.append($createParagraphNode());
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const STYLE_ONLY_PRE_WRAP = /^\s*white-space:\s*pre-wrap;?\s*$/i;

function unwrap(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}

// Lexical exports technical attributes ("dir", white-space styles, <span> wrappers).
// They are removed for a clean template; format tags (strong, em, u, h1..h3, ul/ol) stay.
function cleanExportedDom(container: HTMLElement): void {
  for (const element of Array.from(container.querySelectorAll("*"))) {
    element.removeAttribute("dir");
    element.removeAttribute("class");
    if (element.tagName === "LI") element.removeAttribute("value");

    const style = element.getAttribute("style");
    if (style !== null) {
      const remaining = style
        .split(";")
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration && !STYLE_ONLY_PRE_WRAP.test(declaration));
      if (remaining.length > 0) element.setAttribute("style", `${remaining.join("; ")};`);
      else element.removeAttribute("style");
    }

    // The marker <br> of Lexical's reconcile layer is not content.
    if (element.tagName === "BR" && element.hasAttribute("data-lexical-managed-linebreak")) {
      element.remove();
    }
  }

  // Reduce <b><strong>..</strong></b> and <i><em>..</em></i> to one tag, unwrap bare <span>.
  for (const element of Array.from(container.querySelectorAll("b, i, span"))) {
    const onlyChild = element.children.length === 1 && element.childNodes.length === 1 ? element.children[0] : null;
    const redundant =
      (element.tagName === "B" && onlyChild?.tagName === "STRONG") ||
      (element.tagName === "I" && onlyChild?.tagName === "EM") ||
      (element.tagName === "SPAN" && element.attributes.length === 0);
    if (redundant) unwrap(element);
  }

  // Empty paragraphs only serve editing and would render nothing in the document.
  for (const paragraph of Array.from(container.querySelectorAll("p"))) {
    const onlyBreak = paragraph.children.length === 0 || (paragraph.children.length === 1 && paragraph.children[0].tagName === "BR");
    if (paragraph.textContent === "" && onlyBreak) paragraph.remove();
  }
}

// innerHTML escapes &, < and > even inside {{ ... }}; Handlebars needs the original characters
// (e.g. {{#if (gt a 1)}} or {{name "x"}}).
function restoreMustacheEntities(html: string): string {
  return html.replace(/\{\{[\s\S]*?\}\}/g, (mustache) =>
    mustache
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&"),
  );
}

// "{{#if x}}" as its own paragraph should appear in the template as a bare line, not as <p>{{#if x}}</p>.
const STANDALONE_STATEMENT = /<p>\s*(\{\{~?\s*(?:#|\/|\^|else)[^}]*\}\})\s*<\/p>/g;

// Must run in editor.read() / editor.update() ($generateHtmlFromNodes).
function $exportTemplateHtml(editor: LexicalEditor): string {
  const container = document.createElement("div");
  container.innerHTML = $generateHtmlFromNodes(editor, null);

  // Raw blocks must NOT go through the DOM serializer: it would move {{#each}} between <tr>.
  // Hence placeholder -> token, and in the end token -> comment markers + markup.
  const blocks = new Map<string, string>();
  for (const placeholder of Array.from(container.querySelectorAll(`[${TEMPLATE_BLOCK_ATTRIBUTE}]`))) {
    const token = `@@TEMPLATE_BLOCK_${blocks.size}@@`;
    blocks.set(
      token,
      wrapTemplateBlock(
        {
          id: placeholder.getAttribute("data-block-id") ?? "custom",
          label: placeholder.getAttribute("data-label") ?? "Eigener Block",
        },
        placeholder.getAttribute("data-markup") ?? "",
      ),
    );
    placeholder.replaceWith(document.createTextNode(token));
  }

  cleanExportedDom(container);

  let html = Array.from(container.childNodes)
    .map((node) => (node instanceof Element ? node.outerHTML : (node.textContent ?? "")))
    .join("\n");

  html = restoreMustacheEntities(html).replace(STANDALONE_STATEMENT, "$1");
  for (const [token, block] of blocks) html = html.replace(token, () => block);
  return html;
}

export function exportTemplateHtml(editor: LexicalEditor): string {
  return editor.read(() => $exportTemplateHtml(editor));
}

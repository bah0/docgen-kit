"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

import { useNodeViews } from "./node-views";

// Block node for UNPROCESSED Handlebars markup (tables with {{#each}}, CSS classes, ...).
// Lexical knows neither <table> nor {{#each}} between <tr> elements; the node therefore keeps
// the markup as a string and emits it unchanged on HTML export.

export type SerializedTemplateBlockNode = Spread<
  { blockId: string; label: string; markup: string },
  SerializedLexicalNode
>;

// This attribute marks the placeholder produced by exportDOM(). lexical-html.ts
// replaces it in the final string with the comment markers + the raw markup.
export const TEMPLATE_BLOCK_ATTRIBUTE = "data-template-block";

export class TemplateBlockNode extends DecoratorNode<JSX.Element> {
  __blockId: string;
  __label: string;
  __markup: string;

  static getType(): string {
    return "template-block";
  }

  static clone(node: TemplateBlockNode): TemplateBlockNode {
    return new TemplateBlockNode(node.__blockId, node.__label, node.__markup, node.__key);
  }

  static importJSON(serialized: SerializedTemplateBlockNode): TemplateBlockNode {
    return $createTemplateBlockNode(serialized.blockId, serialized.label, serialized.markup);
  }

  // Used when pasting clipboard HTML (copying between two editors).
  static importDOM(): DOMConversionMap | null {
    return {
      div: (element) =>
        element.hasAttribute(TEMPLATE_BLOCK_ATTRIBUTE)
          ? { conversion: convertTemplateBlockElement, priority: 4 }
          : null,
    };
  }

  constructor(blockId = "custom", label = "Custom block", markup = "", key?: NodeKey) {
    super(key);
    this.__blockId = blockId;
    this.__label = label;
    this.__markup = markup;
  }

  exportJSON(): SerializedTemplateBlockNode {
    return {
      ...super.exportJSON(),
      type: "template-block",
      version: 1,
      blockId: this.__blockId,
      label: this.__label,
      markup: this.__markup,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute(TEMPLATE_BLOCK_ATTRIBUTE, "");
    element.setAttribute("data-block-id", this.__blockId);
    element.setAttribute("data-label", this.__label);
    element.setAttribute("data-markup", this.__markup);
    return { element };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getTextContent(): string {
    return this.__markup;
  }

  getBlockId(): string {
    return this.getLatest().__blockId;
  }

  getLabel(): string {
    return this.getLatest().__label;
  }

  getMarkup(): string {
    return this.getLatest().__markup;
  }

  setMarkup(markup: string): this {
    const writable = this.getWritable();
    writable.__markup = markup;
    return writable;
  }

  decorate(): JSX.Element {
    return (
      <TemplateBlockHost
        nodeKey={this.getKey()}
        blockId={this.__blockId}
        label={this.__label}
        markup={this.__markup}
      />
    );
  }
}

function convertTemplateBlockElement(element: HTMLElement): DOMConversionOutput {
  return {
    node: $createTemplateBlockNode(
      element.getAttribute("data-block-id") ?? "custom",
      element.getAttribute("data-label") ?? "Custom block",
      element.getAttribute("data-markup") ?? "",
    ),
  };
}

export function $createTemplateBlockNode(blockId: string, label: string, markup: string): TemplateBlockNode {
  return $applyNodeReplacement(new TemplateBlockNode(blockId, label, markup));
}

export function $isTemplateBlockNode(node: LexicalNode | null | undefined): node is TemplateBlockNode {
  return node instanceof TemplateBlockNode;
}

interface TemplateBlockHostProps {
  nodeKey: NodeKey;
  blockId: string;
  label: string;
  markup: string;
}

function TemplateBlockHost({ nodeKey, blockId, label, markup }: TemplateBlockHostProps) {
  const [editor] = useLexicalComposerContext();
  const { TemplateBlock } = useNodeViews();

  return (
    <TemplateBlock
      blockId={blockId}
      label={label}
      markup={markup}
      onMarkupChange={(value) =>
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isTemplateBlockNode(node)) node.setMarkup(value);
        })
      }
      onRemove={() =>
        editor.update(() => {
          $getNodeByKey(nodeKey)?.remove();
        })
      }
    />
  );
}

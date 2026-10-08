"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
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

import { ASSET_SCHEME, hasAsset } from "../core/assets";
import { useAssets } from "./AssetsContext";
import { useNodeViews } from "./node-views";

// Image in the text (inline, so the paragraph alignment left/center/right also applies to images).
// The template only contains <img src="asset:ID" style="width: 40mm">; the image data lives in the image list.

export const IMAGE_WIDTH_LIMITS = { min: 5, max: 210 } as const;

export type SerializedImageNode = Spread<{ assetId: string; widthMm: number; alt: string }, SerializedLexicalNode>;

export class ImageNode extends DecoratorNode<JSX.Element> {
  __assetId: string;
  __widthMm: number;
  __alt: string;

  static getType(): string {
    return "template-image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__assetId, node.__widthMm, node.__alt, node.__key);
  }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    return $createImageNode(serialized.assetId, serialized.widthMm, serialized.alt);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: (element) =>
        element.getAttribute("src")?.startsWith(ASSET_SCHEME) ? { conversion: convertImageElement, priority: 4 } : null,
    };
  }

  constructor(assetId = "", widthMm = 40, alt = "", key?: NodeKey) {
    super(key);
    this.__assetId = assetId;
    this.__widthMm = widthMm;
    this.__alt = alt;
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: "template-image",
      version: 1,
      assetId: this.__assetId,
      widthMm: this.__widthMm,
      alt: this.__alt,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    element.setAttribute("src", `${ASSET_SCHEME}${this.__assetId}`);
    element.setAttribute("alt", this.__alt);
    element.style.width = `${this.__widthMm}mm`;
    return { element };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  setWidthMm(widthMm: number): this {
    const writable = this.getWritable();
    writable.__widthMm = widthMm;
    return writable;
  }

  decorate(): JSX.Element {
    return <ImageHost nodeKey={this.getKey()} assetId={this.__assetId} widthMm={this.__widthMm} alt={this.__alt} />;
  }
}

function convertImageElement(element: HTMLElement): DOMConversionOutput {
  const src = element.getAttribute("src") ?? "";
  const width = /^([\d.]+)mm$/.exec(element.style.width);
  return {
    node: $createImageNode(
      src.slice(ASSET_SCHEME.length),
      width ? Number(width[1]) : 40,
      element.getAttribute("alt") ?? "",
    ),
  };
}

export function $createImageNode(assetId: string, widthMm: number, alt: string): ImageNode {
  return $applyNodeReplacement(new ImageNode(assetId, widthMm, alt));
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

interface ImageHostProps {
  nodeKey: NodeKey;
  assetId: string;
  widthMm: number;
  alt: string;
}

function ImageHost({ nodeKey, assetId, widthMm, alt }: ImageHostProps) {
  const [editor] = useLexicalComposerContext();
  const assets = useAssets();
  const { Image } = useNodeViews();
  const asset = hasAsset(assets, assetId) ? assets[assetId] : null;
  const [selected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  return (
    <Image
      asset={asset}
      widthMm={widthMm}
      alt={alt}
      selected={selected}
      onSelect={(additive) => {
        if (!additive) clearSelection();
        setSelected(true);
      }}
      onWidthChange={(mm) => {
        if (!Number.isFinite(mm) || mm < IMAGE_WIDTH_LIMITS.min || mm > IMAGE_WIDTH_LIMITS.max) return;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) node.setWidthMm(mm);
        });
      }}
      onRemove={() =>
        editor.update(() => {
          $getNodeByKey(nodeKey)?.remove();
        })
      }
    />
  );
}

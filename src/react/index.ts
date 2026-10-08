"use client";

// Lexical + React bindings: editor nodes for template blocks, images and form fields, HTML import/export,
// a sync plugin and a live preview component. Needs the peer dependencies react, lexical, @lexical/html
// and @lexical/react.

import { FormFieldNode } from "./FormFieldNode";
import { ImageNode } from "./ImageNode";
import { TemplateBlockNode } from "./TemplateBlockNode";

export * from "./AssetsContext";
export * from "./DocumentPreview";
export * from "./FormFieldNode";
export * from "./FormFieldsContext";
export * from "./ImageNode";
export * from "./TemplateBlockNode";
export * from "./TemplateHtmlPlugin";
export * from "./lexical-html";
export { defaultNodeViews } from "./default-views";
export { NodeViewsProvider, useNodeViews } from "./node-views";
export type { FormFieldViewProps, ImageViewProps, NodeViews, TemplateBlockViewProps } from "./node-views";

// Register these in `LexicalComposer`'s `nodes` next to the standard nodes you use.
export const templateNodes = [TemplateBlockNode, ImageNode, FormFieldNode];

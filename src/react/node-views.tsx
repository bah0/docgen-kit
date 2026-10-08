"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";

import type { ImageAsset } from "../core/assets";
import type { FormFieldDef } from "../core/form-fields";
import { defaultNodeViews } from "./default-views";

// The editor nodes (template block, image, form field) handle all Lexical integration. What they look
// like is delegated to "views": plain React components that only receive data and callbacks.
// Replace them with your own design-system components via <NodeViewsProvider>.

export interface TemplateBlockViewProps {
  blockId: string;
  label: string;
  // Unprocessed Handlebars markup of the block.
  markup: string;
  onMarkupChange: (markup: string) => void;
  onRemove: () => void;
}

export interface ImageViewProps {
  // null if the referenced image no longer exists in the image list.
  asset: ImageAsset | null;
  widthMm: number;
  alt: string;
  selected: boolean;
  // Call on click; `additive` is true when shift was pressed.
  onSelect: (additive: boolean) => void;
  // Called with any number; values outside IMAGE_WIDTH_LIMITS are ignored.
  onWidthChange: (widthMm: number) => void;
  onRemove: () => void;
}

export interface FormFieldViewProps {
  // null if the referenced field definition no longer exists.
  field: FormFieldDef | null;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  // Ask the application to open its properties editor for this field.
  onEdit: () => void;
  onRemove: () => void;
}

export interface NodeViews {
  TemplateBlock: ComponentType<TemplateBlockViewProps>;
  Image: ComponentType<ImageViewProps>;
  FormField: ComponentType<FormFieldViewProps>;
}

const NodeViewsContext = createContext<NodeViews>(defaultNodeViews);

export function NodeViewsProvider({ views, children }: { views: Partial<NodeViews>; children: ReactNode }) {
  const parent = useContext(NodeViewsContext);
  return <NodeViewsContext.Provider value={{ ...parent, ...views }}>{children}</NodeViewsContext.Provider>;
}

export function useNodeViews(): NodeViews {
  return useContext(NodeViewsContext);
}

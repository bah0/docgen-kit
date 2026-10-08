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

import { FIELD_ATTRIBUTE, isFieldId } from "../core/form-fields";
import { useFormFields } from "./FormFieldsContext";
import { useNodeViews } from "./node-views";

// Fillable form field in the text (inline). The template only contains
// <span data-form-field="ID"></span>; type, name and size live in the document's field list.

export type SerializedFormFieldNode = Spread<{ fieldId: string }, SerializedLexicalNode>;

export class FormFieldNode extends DecoratorNode<JSX.Element> {
  __fieldId: string;

  static getType(): string {
    return "form-field";
  }

  static clone(node: FormFieldNode): FormFieldNode {
    return new FormFieldNode(node.__fieldId, node.__key);
  }

  static importJSON(serialized: SerializedFormFieldNode): FormFieldNode {
    return $createFormFieldNode(serialized.fieldId);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (element) =>
        isFieldId(element.getAttribute(FIELD_ATTRIBUTE) ?? "") ? { conversion: convertFieldElement, priority: 4 } : null,
    };
  }

  constructor(fieldId = "", key?: NodeKey) {
    super(key);
    this.__fieldId = fieldId;
  }

  exportJSON(): SerializedFormFieldNode {
    return { ...super.exportJSON(), type: "form-field", version: 1, fieldId: this.__fieldId };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute(FIELD_ATTRIBUTE, this.__fieldId);
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

  getFieldId(): string {
    return this.getLatest().__fieldId;
  }

  decorate(): JSX.Element {
    return <FormFieldHost nodeKey={this.getKey()} fieldId={this.__fieldId} />;
  }
}

function convertFieldElement(element: HTMLElement): DOMConversionOutput {
  return { node: $createFormFieldNode(element.getAttribute(FIELD_ATTRIBUTE) ?? "") };
}

export function $createFormFieldNode(fieldId: string): FormFieldNode {
  return $applyNodeReplacement(new FormFieldNode(fieldId));
}

export function $isFormFieldNode(node: LexicalNode | null | undefined): node is FormFieldNode {
  return node instanceof FormFieldNode;
}

function FormFieldHost({ nodeKey, fieldId }: { nodeKey: NodeKey; fieldId: string }) {
  const [editor] = useLexicalComposerContext();
  const { fields, onEditField } = useFormFields();
  const { FormField } = useNodeViews();
  const field = Object.hasOwn(fields, fieldId) ? fields[fieldId] : null;
  const [selected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  return (
    <FormField
      field={field}
      selected={selected}
      onSelect={(additive) => {
        if (!additive) clearSelection();
        setSelected(true);
      }}
      onEdit={() => field && onEditField(field.id)}
      onRemove={() =>
        editor.update(() => {
          $getNodeByKey(nodeKey)?.remove();
        })
      }
    />
  );
}

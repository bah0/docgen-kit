"use client";

import { createContext, useContext } from "react";

import type { FieldMap, FormFieldDef } from "../core/form-fields";

// Gives editor nodes (FormFieldNode) and the toolbar access to the document's form fields.
export interface FormFieldsContextValue {
  fields: FieldMap;
  // Creates or updates a field (the parent writes to the document store).
  onSaveField: (field: FormFieldDef) => void;
  // Opens the parent's properties dialog.
  onEditField: (id: string) => void;
}

export const FormFieldsContext = createContext<FormFieldsContextValue>({
  fields: {},
  onSaveField: () => {},
  onEditField: () => {},
});

export function useFormFields(): FormFieldsContextValue {
  return useContext(FormFieldsContext);
}

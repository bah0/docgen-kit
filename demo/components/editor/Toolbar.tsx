"use client";

import { $setBlocksType } from "@lexical/selection";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode, $isHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $insertNodeToNearestRoot, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type ParagraphNode,
} from "lexical";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  CalendarDays,
  ChevronsUpDown,
  CircleDot,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  MousePointerClick,
  NotepadText,
  PenLine,
  Pilcrow,
  Redo2,
  Repeat,
  Scissors,
  SquareCheck,
  Table2,
  TextCursorInput,
  Underline,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import { $createFormFieldNode, $createImageNode, $createTemplateBlockNode, useFormFields } from "docgen-kit/react";
import { ImageDialog } from "@/components/editor/ImageDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createFormField, FIELD_TYPE_ORDER, FIELD_TYPES, type AssetMap, type DocumentBlock, type FormFieldType, type ImageAsset, type LoopOption, type VariableOption } from "docgen-kit";
import { demoBlocks as documentBlocks, demoCustomBlock as customBlock, getDemoBlock as getBlockById } from "@/lib/blocks";

type BlockType = "paragraph" | HeadingTagType | "bullet" | "number";
type InsertTab = "variables" | "loops" | "blocks" | "fields";

const FIELD_ICONS: Record<FormFieldType, ComponentType<{ className?: string }>> = {
  text: TextCursorInput,
  textarea: NotepadText,
  date: CalendarDays,
  checkbox: SquareCheck,
  radio: CircleDot,
  dropdown: ChevronsUpDown,
  listbox: ListChecks,
  signature: PenLine,
  button: MousePointerClick,
};

export interface ToolbarProps {
  // Derived from the current JSON (lib/handlebars.ts: extractVariablePaths).
  variables: VariableOption[];
  loops: LoopOption[];
  // Image list of the document; new uploads go to the parent.
  assets: AssetMap;
  onAddAsset: (asset: ImageAsset) => void;
  // Called after a block is inserted so the parent can add missing example data.
  onBlockInserted?: (block: DocumentBlock) => void;
}

// Default width of a new image: original size at 96 dpi, at most 50 mm.
function defaultImageWidthMm(asset: ImageAsset): number {
  return Math.max(5, Math.min(50, Math.round((asset.width * 25.4) / 96)));
}

function ToolbarButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={active ? "secondary" : "ghost"}
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            // Prevents the click from taking focus (and with it the selection) out of the editor.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Toolbar({ variables, loops, assets, onAddAsset, onBlockInserted }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [format, setFormat] = useState({ bold: false, italic: false, underline: false });
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [align, setAlign] = useState<ElementFormatType>("");
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [dialog, setDialog] = useState<{ open: boolean; tab: InsertTab }>({ open: false, tab: "variables" });
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const { fields, onSaveField, onEditField } = useFormFields();
  useEffect(() => {
    const readState = () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      setFormat({
        bold: selection.hasFormat("bold"),
        italic: selection.hasFormat("italic"),
        underline: selection.hasFormat("underline"),
      });
      const anchor = selection.anchor.getNode();
      const top = anchor.getKey() === "root" ? anchor : anchor.getTopLevelElementOrThrow();
      setAlign($isElementNode(top) ? top.getFormatType() : "");
      if ($isListNode(top)) setBlockType(top.getListType() === "number" ? "number" : "bullet");
      else if ($isHeadingNode(top)) setBlockType(top.getTag());
      else setBlockType("paragraph");
    };

    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => editorState.read(readState)),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          readState();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (canUndo) => {
          setHistory((current) => ({ ...current, canUndo }));
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (canRedo) => {
          setHistory((current) => ({ ...current, canRedo }));
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  const setBlock = (type: "paragraph" | HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => (type === "paragraph" ? $createParagraphNode() : $createHeadingNode(type)));
      }
    });
  };

  const toggleList = (type: "bullet" | "number") => {
    if (blockType === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(type === "bullet" ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
    }
  };

  // --- Insert: variables, loops, blocks ----------------------------

  const insertVariable = (variable: VariableOption) => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd();
        selection = $getSelection();
      }
      if ($isRangeSelection(selection)) selection.insertText(variable.expression);
    });
    closeDialog();
  };

  // Loop as three paragraphs: "{{#each path}}", one example line and "{{/each}}".
  // On export, the two control statements become bare lines in the template.
  const insertLoop = (loop: LoopOption) => {
    editor.update(() => {
      const selection = $getSelection();
      const anchor = $isRangeSelection(selection) ? selection.anchor.getNode().getTopLevelElement() : null;
      const paragraphs = loop.lines.map((line) => $createParagraphNode().append($createTextNode(line)));

      const [first, ...rest] = paragraphs;
      if ($isParagraphNode(anchor) && anchor.getTextContentSize() === 0) {
        anchor.replace(first);
      } else if (anchor) {
        anchor.insertAfter(first);
      } else {
        $getRoot().append(first);
      }
      let cursor: ParagraphNode = first;
      for (const paragraph of rest) {
        cursor.insertAfter(paragraph);
        cursor = paragraph;
      }
      paragraphs[1].selectEnd();
    });
    closeDialog();
  };

  const insertBlock = (block: DocumentBlock) => {
    editor.update(() => {
      const node = $createTemplateBlockNode(block.id, block.title, block.markup);
      if ($isRangeSelection($getSelection())) $insertNodeToNearestRoot(node);
      else $getRoot().append(node);
      // A paragraph must follow the block so the cursor can keep writing.
      if (!node.getNextSibling()) node.insertAfter($createParagraphNode());
    });
    onBlockInserted?.(block);
    closeDialog();
  };

  const insertPageBreak = () => {
    const block = getBlockById("page-break");
    if (block) insertBlock(block);
  };

  // Inline node: the paragraph's alignment therefore also applies to the image.
  const insertImage = (asset: ImageAsset) => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd();
        selection = $getSelection();
      }
      if ($isRangeSelection(selection)) {
        selection.insertNodes([$createImageNode(asset.id, defaultImageWidthMm(asset), asset.name)]);
      }
    });
    setImageDialogOpen(false);
  };

  // New form field: save the definition, insert the placeholder node and open the properties.
  const insertField = (type: FormFieldType) => {
    const field = createFormField(type, fields);
    onSaveField(field);
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectEnd();
        selection = $getSelection();
      }
      if ($isRangeSelection(selection)) selection.insertNodes([$createFormFieldNode(field.id)]);
    });
    closeDialog();
    onEditField(field.id);
  };

  const alignment = align || "left";
  const alignTo = (type: ElementFormatType) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, type);

  const openDialog = (tab: InsertTab) => setDialog({ open: true, tab });
  const closeDialog = () => setDialog((current) => ({ ...current, open: false }));

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5" role="toolbar" aria-label="Editor tools">
      <ToolbarButton label="Undo" disabled={!history.canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!history.canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
        <Redo2 />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Bold" active={format.bold} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={format.italic} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={format.underline} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}>
        <Underline />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Paragraph" active={blockType === "paragraph"} onClick={() => setBlock("paragraph")}>
        <Pilcrow />
      </ToolbarButton>
      <ToolbarButton label="Heading 1" active={blockType === "h1"} onClick={() => setBlock("h1")}>
        <Heading1 />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={blockType === "h2"} onClick={() => setBlock("h2")}>
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={blockType === "h3"} onClick={() => setBlock("h3")}>
        <Heading3 />
      </ToolbarButton>
      <ToolbarButton label="Bulleted list" active={blockType === "bullet"} onClick={() => toggleList("bullet")}>
        <List />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={blockType === "number"} onClick={() => toggleList("number")}>
        <ListOrdered />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Align left" active={alignment === "left"} onClick={() => alignTo("left")}>
        <AlignLeft />
      </ToolbarButton>
      <ToolbarButton label="Align center" active={alignment === "center"} onClick={() => alignTo("center")}>
        <AlignCenter />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={alignment === "right"} onClick={() => alignTo("right")}>
        <AlignRight />
      </ToolbarButton>
      <ToolbarButton label="Justify" active={alignment === "justify"} onClick={() => alignTo("justify")}>
        <AlignJustify />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarButton label="Insert variable" onClick={() => openDialog("variables")}>
        <Braces />
      </ToolbarButton>
      <ToolbarButton label="Insert loop" onClick={() => openDialog("loops")}>
        <Repeat />
      </ToolbarButton>
      <ToolbarButton label="Insert block" onClick={() => openDialog("blocks")}>
        <Table2 />
      </ToolbarButton>
      <ToolbarButton label="Insert image" onClick={() => setImageDialogOpen(true)}>
        <ImagePlus />
      </ToolbarButton>
      <ToolbarButton label="Insert form field" onClick={() => openDialog("fields")}>
        <TextCursorInput />
      </ToolbarButton>
      <ToolbarButton label="Insert page break" onClick={insertPageBreak}>
        <Scissors />
      </ToolbarButton>

      <ImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        assets={assets}
        onAddAsset={onAddAsset}
        onInsert={insertImage}
        onClosed={() => editor.focus()}
      />

      <InsertDialog
        open={dialog.open}
        tab={dialog.tab}
        onTabChange={(tab) => setDialog({ open: true, tab })}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        variables={variables}
        loops={loops}
        onInsertVariable={insertVariable}
        onInsertLoop={insertLoop}
        onInsertBlock={insertBlock}
        onInsertField={insertField}
        onClosed={() => editor.focus()}
      />
    </div>
  );
}

interface InsertDialogProps {
  open: boolean;
  tab: InsertTab;
  onTabChange: (tab: InsertTab) => void;
  onOpenChange: (open: boolean) => void;
  variables: VariableOption[];
  loops: LoopOption[];
  onInsertVariable: (variable: VariableOption) => void;
  onInsertLoop: (loop: LoopOption) => void;
  onInsertBlock: (block: DocumentBlock) => void;
  onInsertField: (type: FormFieldType) => void;
  onClosed: () => void;
}

function InsertDialog({
  open,
  tab,
  onTabChange,
  onOpenChange,
  variables,
  loops,
  onInsertVariable,
  onInsertLoop,
  onInsertBlock,
  onInsertField,
  onClosed,
}: InsertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        finalFocus={() => {
          onClosed();
          return false;
        }}
      >
        <DialogHeader>
          <DialogTitle>Insert into the template</DialogTitle>
          <DialogDescription>
            Variables and loops come from the keys of the JSON data. Blocks are inserted as unprocessed Handlebars
            markup. Form fields become fillable AcroForm fields in the PDF.
          </DialogDescription>
        </DialogHeader>
        <InsertPanel
          tab={tab}
          onTabChange={onTabChange}
          variables={variables}
          loops={loops}
          onInsertVariable={onInsertVariable}
          onInsertLoop={onInsertLoop}
          onInsertBlock={onInsertBlock}
          onInsertField={onInsertField}
        />
      </DialogContent>
    </Dialog>
  );
}

// The dialog content is unmounted on close, so the search starts empty on every open.
function InsertPanel({
  tab,
  onTabChange,
  variables,
  loops,
  onInsertVariable,
  onInsertLoop,
  onInsertBlock,
  onInsertField,
}: Omit<InsertDialogProps, "open" | "onOpenChange" | "onClosed">) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const filteredVariables = useMemo(
    () => variables.filter((variable) => !needle || variable.path.toLowerCase().includes(needle)),
    [variables, needle],
  );
  const filteredLoops = useMemo(
    () => loops.filter((loop) => !needle || loop.path.toLowerCase().includes(needle)),
    [loops, needle],
  );
  const filteredBlocks = useMemo(
    () =>
      [...documentBlocks, customBlock].filter(
        (block) => !needle || `${block.title} ${block.description} ${block.category}`.toLowerCase().includes(needle),
      ),
    [needle],
  );
  const filteredFields = useMemo(
    () =>
      FIELD_TYPE_ORDER.filter(
        (type) =>
          !needle || `${FIELD_TYPES[type].label} ${FIELD_TYPES[type].description}`.toLowerCase().includes(needle),
      ),
    [needle],
  );

  return (
    <>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search …"
        aria-label="Search"
      />
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as InsertTab)}>
        <TabsList>
          <TabsTrigger value="variables">Variables ({filteredVariables.length})</TabsTrigger>
          <TabsTrigger value="loops">Loops ({filteredLoops.length})</TabsTrigger>
          <TabsTrigger value="blocks">Blocks ({filteredBlocks.length})</TabsTrigger>
          <TabsTrigger value="fields">Form fields ({filteredFields.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="variables" className="max-h-80 overflow-y-auto pt-2">
          {filteredVariables.length === 0 && <EmptyHint text="No variables found. Is the JSON valid?" />}
          <ul className="grid gap-1">
            {filteredVariables.map((variable) => (
              <li key={variable.path}>
                <button
                  type="button"
                  onClick={() => onInsertVariable(variable)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <code className="font-mono text-xs">{variable.expression}</code>
                  <span className="truncate text-xs text-muted-foreground">{variable.sample}</span>
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="loops" className="max-h-80 overflow-y-auto pt-2">
          {filteredLoops.length === 0 && <EmptyHint text="No arrays found in the JSON data." />}
          <ul className="grid gap-1">
            {filteredLoops.map((loop) => (
              <li key={loop.path}>
                <button
                  type="button"
                  onClick={() => onInsertLoop(loop)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <code className="font-mono text-xs">
                    {loop.lines[0]} … {loop.lines[2]}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {loop.length} entries · Fields: {loop.itemFields.join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="blocks" className="max-h-80 overflow-y-auto pt-2">
          {filteredBlocks.length === 0 && <EmptyHint text="No blocks found." />}
          <ul className="grid gap-1">
            {filteredBlocks.map((block) => (
              <li key={block.id}>
                <button
                  type="button"
                  onClick={() => onInsertBlock(block)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="text-sm font-medium">
                    {block.title} <span className="font-normal text-muted-foreground">· {block.category}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{block.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="fields" className="max-h-80 overflow-y-auto pt-2">
          {filteredFields.length === 0 && <EmptyHint text="No form fields found." />}
          <ul className="grid gap-1 sm:grid-cols-2">
            {filteredFields.map((type) => {
              const Icon = FIELD_ICONS[type];
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => onInsertField(type)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{FIELD_TYPES[type].label}</span>
                      <span className="text-xs text-muted-foreground">{FIELD_TYPES[type].description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="px-2 py-4 text-sm text-muted-foreground">{text}</p>;
}

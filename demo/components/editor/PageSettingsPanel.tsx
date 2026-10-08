"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssetMap } from "docgen-kit";
import {
  clampNumber,
  IMAGE_HEIGHT_LIMITS,
  MARGIN_LIMITS,
  SLOT_POSITIONS,
  type DocumentSettings,
  type PageBand,
  type PageMargins,
  type PageNumberPosition,
  type PageSlot,
  type SlotPosition,
} from "docgen-kit";
import { cn } from "@/lib/utils";

interface PageSettingsPanelProps {
  settings: DocumentSettings;
  assets: AssetMap;
  onChange: (settings: DocumentSettings) => void;
}

export const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const SLOT_LABELS: Record<SlotPosition, string> = { left: "Left", center: "Center", right: "Right" };

const MARGIN_LABELS: Record<keyof PageMargins, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

// Number field that may briefly be empty or out of range while typing; only valid values are committed.
export function NumberField({
  id,
  value,
  min,
  max,
  onCommit,
  ...props
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "min" | "max" | "type">) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      {...props}
      id={id}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        const number = Number(event.target.value);
        if (event.target.value !== "" && Number.isFinite(number)) onCommit(clampNumber(number, min, max, value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function SlotFields({
  id,
  position,
  slot,
  assets,
  onChange,
}: {
  id: string;
  position: SlotPosition;
  slot: PageSlot;
  assets: AssetMap;
  onChange: (slot: PageSlot) => void;
}) {
  const options = Object.values(assets);
  // If the slot points to a deleted image, the selection stays visible.
  const missing = slot.imageId !== null && !options.some((asset) => asset.id === slot.imageId);

  return (
    <div className="grid content-start gap-1.5 rounded-lg border p-2">
      <Label htmlFor={`${id}-text`} className="text-xs font-medium">
        {SLOT_LABELS[position]}
      </Label>
      <Input
        id={`${id}-text`}
        value={slot.text}
        placeholder="Text, e.g. {{company.name}}"
        onChange={(event) => onChange({ ...slot, text: event.target.value })}
      />
      <select
        aria-label={`Image ${SLOT_LABELS[position]}`}
        className={SELECT_CLASS}
        value={slot.imageId ?? ""}
        onChange={(event) => onChange({ ...slot, imageId: event.target.value || null })}
      >
        <option value="">– no image –</option>
        {missing && <option value={slot.imageId ?? ""}>(deleted image)</option>}
        {options.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.name}
          </option>
        ))}
      </select>
      {slot.imageId !== null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Label htmlFor={`${id}-height`} className="text-xs font-normal">
            Image height
          </Label>
          <NumberField
            id={`${id}-height`}
            className="h-7 w-16"
            value={slot.imageHeightMm}
            min={IMAGE_HEIGHT_LIMITS.min}
            max={IMAGE_HEIGHT_LIMITS.max}
            onCommit={(imageHeightMm) => onChange({ ...slot, imageHeightMm })}
          />
          mm
        </div>
      )}
    </div>
  );
}

function BandFields({
  id,
  title,
  hint,
  band,
  assets,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  band: PageBand;
  assets: AssetMap;
  onChange: (band: PageBand) => void;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground">{hint}</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {SLOT_POSITIONS.map((position) => (
          <SlotFields
            key={position}
            id={`${id}-${position}`}
            position={position}
            slot={band[position]}
            assets={assets}
            onChange={(slot) => onChange({ ...band, [position]: slot })}
          />
        ))}
      </div>
    </fieldset>
  );
}

// Page layout of a document. Everything ends up in the same HTML as the content (lib/page-decor.ts):
// margins as @page margins, header/footer and page number as @page margin boxes.
export function PageSettingsPanel({ settings, assets, onChange }: PageSettingsPanelProps) {
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Page margins (mm)</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(MARGIN_LABELS) as (keyof PageMargins)[]).map((side) => (
            <div key={side} className="grid gap-1">
              <Label htmlFor={`margin-${side}`} className="text-xs font-normal text-muted-foreground">
                {MARGIN_LABELS[side]}
              </Label>
              <NumberField
                id={`margin-${side}`}
                value={settings.margins[side]}
                min={MARGIN_LIMITS.min}
                max={MARGIN_LIMITS.max}
                onCommit={(value) => onChange({ ...settings, margins: { ...settings.margins, [side]: value } })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <BandFields
        id="header"
        title="Header"
        hint="(in the top margin)"
        band={settings.header}
        assets={assets}
        onChange={(header) => onChange({ ...settings, header })}
      />
      <BandFields
        id="footer"
        title="Footer"
        hint="(in the bottom margin)"
        band={settings.footer}
        assets={assets}
        onChange={(footer) => onChange({ ...settings, footer })}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="page-number" className="text-sm font-medium">
          Page number (e.g. 1/23)
        </Label>
        <select
          id="page-number"
          className={cn(SELECT_CLASS, "sm:max-w-xs")}
          value={settings.pageNumber}
          onChange={(event) => onChange({ ...settings, pageNumber: event.target.value as PageNumberPosition })}
        >
          <option value="none">None</option>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-center">Bottom center</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        Images and text must fit into the margin (image height is capped at the margin minus 2 mm). The page number
        follows the text of the selected footer slot.
      </p>
    </div>
  );
}

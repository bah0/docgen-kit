"use client";

import { Trash2 } from "lucide-react";

import { ImageUploadButton } from "@/components/editor/ImageUploadButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSET_SCHEME, SLOT_POSITIONS, type AssetMap, type DocumentSettings, type ImageAsset } from "docgen-kit";

interface ImageLibraryProps {
  assets: AssetMap;
  template: string;
  settings: DocumentSettings;
  onAdd: (asset: ImageAsset) => void;
  onRemove: (id: string) => void;
}

function countUsage(id: string, template: string, settings: DocumentSettings): number {
  const inText = template.split(`${ASSET_SCHEME}${id}"`).length - 1;
  const inSlots = [settings.header, settings.footer].reduce(
    (sum, band) => sum + SLOT_POSITIONS.filter((position) => band[position].imageId === id).length,
    0,
  );
  return inText + inSlots;
}

function formatSize(chars: number): string {
  // Base64 takes about 4/3 of the file size; what is shown is the storage requirement.
  return chars < 1024 * 1024 ? `${Math.max(1, Math.round(chars / 1024))} KB` : `${(chars / 1024 / 1024).toFixed(1)} MB`;
}

// Images of the document. They are stored together with the template and JSON in browser storage (about 5 MB of space).
export function ImageLibrary({ assets, template, settings, onAdd, onRemove }: ImageLibraryProps) {
  const list = Object.values(assets);
  const total = list.reduce((sum, asset) => sum + asset.dataUri.length, 0);

  const remove = (asset: ImageAsset) => {
    const usage = countUsage(asset.id, template, settings);
    if (usage > 0 && !window.confirm(`“${asset.name}” is used ${usage}×. Delete anyway?`)) return;
    onRemove(asset.id);
  };

  return (
    <div className="grid gap-3">
      <ImageUploadButton onUploaded={onAdd} />
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <ul className="grid gap-2">
          {list.map((asset) => {
            const usage = countUsage(asset.id, template, settings);
            return (
              <li key={asset.id} className="flex items-center gap-3 rounded-lg border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI from the image list */}
                <img src={asset.dataUri} alt="" className="size-12 shrink-0 rounded border bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{asset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {asset.mime.replace("image/", "").replace("+xml", "")} · {Math.round(asset.width)} ×{" "}
                    {Math.round(asset.height)} px · {formatSize(asset.dataUri.length)}
                  </p>
                </div>
                {usage > 0 && <Badge variant="secondary">used {usage}×</Badge>}
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => remove(asset)} aria-label="Delete image">
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 0 && <p className="text-xs text-muted-foreground">Total: {formatSize(total)}</p>}
    </div>
  );
}

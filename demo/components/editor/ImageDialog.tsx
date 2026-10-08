"use client";

import { ImageUploadButton } from "@/components/editor/ImageUploadButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetMap, ImageAsset } from "docgen-kit";

interface ImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetMap;
  onAddAsset: (asset: ImageAsset) => void;
  onInsert: (asset: ImageAsset) => void;
  onClosed: () => void;
}

// Insert an image into the text: upload a new one or pick an existing one from the image list.
export function ImageDialog({ open, onOpenChange, assets, onAddAsset, onInsert, onClosed }: ImageDialogProps) {
  const list = Object.values(assets);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        finalFocus={() => {
          onClosed();
          return false;
        }}
      >
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>
            The image ends up as an &lt;img&gt; in the text. PNG and JPG are downscaled, SVG is sanitised. Alignment
            follows the paragraph; the width can be changed after clicking the image.
          </DialogDescription>
        </DialogHeader>
        <ImageUploadButton
          variant="default"
          onUploaded={(asset) => {
            onAddAsset(asset);
            onInsert(asset);
          }}
        />
        {list.length > 0 && (
          <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
            {list.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onInsert(asset)}
                  className="grid w-full gap-1 rounded-lg border p-2 text-left hover:bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI from the image list */}
                  <img src={asset.dataUri} alt="" className="h-16 w-full object-contain" />
                  <span className="truncate text-xs">{asset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

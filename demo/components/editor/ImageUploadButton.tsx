"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import type { ImageAsset } from "docgen-kit";
import { createImageAsset, IMAGE_ACCEPT } from "docgen-kit/client";

interface ImageUploadButtonProps {
  onUploaded: (asset: ImageAsset) => void;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
}

// Picks a file (SVG, PNG, JPG), downscales/sanitises it and returns the finished image.
export function ImageUploadButton({ onUploaded, variant = "outline", size = "sm" }: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await createImageAsset(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The image could not be loaded.");
    } finally {
      setBusy(false);
      // The same file should be selectable again.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose image file"
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <Button type="button" variant={variant} size={size} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
        Upload image (SVG, PNG, JPG)
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

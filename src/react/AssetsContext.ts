"use client";

import { createContext, useContext } from "react";

import type { AssetMap } from "../core/assets";

// Gives editor nodes (ImageNode) access to the document's image list.
export const AssetsContext = createContext<AssetMap>({});

export function useAssets(): AssetMap {
  return useContext(AssetsContext);
}

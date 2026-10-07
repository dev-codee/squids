"use client";

import { useState, useEffect, useCallback } from "react";

export interface SavedItem {
  id: number;
  title: string;
  imageUrl?: string | null;
  salePrice?: number | null;
  category?: string | null;
  brand?: string | null;
  size?: string | null;
  addedAt: string;
}

const STORAGE_KEY = "foxzil_saved_items";

export function getSavedItems(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && Number.isFinite(item.id) && typeof item.title === "string") : [];
  } catch {
    return [];
  }
}

export function isItemSaved(id: number): boolean {
  if (typeof window === "undefined") return false;
  const items = getSavedItems();
  return items.some((item) => item.id === id);
}

export function toggleSavedItem(item: Omit<SavedItem, "addedAt">): boolean {
  if (typeof window === "undefined") return false;
  const items = getSavedItems();
  const index = items.findIndex((i) => i.id === item.id);
  let next: SavedItem[];
  let isSaved = false;

  if (index >= 0) {
    next = items.filter((i) => i.id !== item.id);
    isSaved = false;
  } else {
    next = [{ ...item, addedAt: new Date().toISOString() }, ...items];
    isSaved = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("foxzil_saved_updated"));
  } catch {
    return index >= 0; // Preserve the actual stored state when writing fails.
  }

  return isSaved;
}

export function useSavedItems() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(() => {
    setItems(getSavedItems());
    setIsReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener("foxzil_saved_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("foxzil_saved_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [refresh]);

  const toggle = useCallback((item: Omit<SavedItem, "addedAt">) => {
    return toggleSavedItem(item);
  }, []);

  const isSaved = useCallback(
    (id: number) => {
      return items.some((i) => i.id === id);
    },
    [items],
  );

  return { items, isSaved, toggle, isReady };
}

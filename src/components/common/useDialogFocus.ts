"use client";
import { useEffect, useRef } from "react";
export function useDialogFocus(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current;
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]')];
    (controls()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose.current(); }
      if (event.key !== "Tab") return;
      const elements = controls();
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", keydown);
    return () => { dialog.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  return ref;
}

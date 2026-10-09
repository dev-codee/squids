"use client";
import { useState } from "react";
import ProductIcon from "./ProductIcon";
export default function ProductImage({ src, title, className = "", priority = false }: { src?: string | null; title: string; className?: string; priority?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return <div className={`flex items-center justify-center ${className}`}>
    {src && failedSrc !== src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} loading={priority ? "eager" : "lazy"} onError={() => setFailedSrc(src)} className="h-full max-h-full w-full object-contain mix-blend-multiply" />
    ) : <div className="flex flex-col items-center gap-3 text-ink-muted"><ProductIcon name="package" className="h-12 w-12 opacity-40" /><span className="max-w-40 text-center text-xs">{title}</span></div>}
  </div>;
}

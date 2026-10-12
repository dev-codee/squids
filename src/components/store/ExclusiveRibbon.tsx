/** A compact corner ribbon; the label comes from the page's dictionary. */
export default function ExclusiveRibbon({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 h-[84px] w-[84px] overflow-hidden rounded-tl-[inherit]" aria-label={label}>
      <span className="absolute -left-[29px] top-[18px] flex h-6 w-[124px] -rotate-45 items-center justify-center gap-1 border-y border-white/25 bg-gradient-to-r from-[#c2410c] via-[#ea580c] to-[#f97316] text-[9px] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_3px_7px_rgba(154,52,18,0.24)]">
        <svg aria-hidden="true" className="h-2.5 w-2.5 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="m8 1.5 1.9 3.85 4.25.62-3.08 3 .73 4.23L8 11.2l-3.8 2 .72-4.23-3.07-3 4.25-.62L8 1.5Z" /></svg>
        <span>{label}</span>
      </span>
    </div>
  );
}

interface StarRatingProps {
  /** 0-5, fractional values render a partial star. */
  value: number;
  size?: "xs" | "sm" | "md";
}

const SIZE_CLASSES: Record<NonNullable<StarRatingProps["size"]>, string> = {
  xs: "text-xs",
  sm: "text-base",
  md: "text-lg",
};

/** Five-star display with proportional partial-fill (not just floor/ceil). */
export default function StarRating({ value, size = "sm" }: StarRatingProps) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <span className={`relative inline-block leading-none tracking-tight ${sizeClass}`} aria-hidden="true">
      <span className="text-gray-300">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-400"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}

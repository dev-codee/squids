"use client";

import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import type { PriceObservation } from "@/lib/model/priceObservation";
import { buildPriceHistorySeries } from "@/lib/model/priceObservation";

interface PriceHistoryPanelProps {
  observations?: PriceObservation[];
  currency?: string;
}

/**
 * Price history panel.
 *
 * Renders honest observations over time. History begins at first real observation;
 * if no tracking data exists, renders the standard empty state. Gaps are preserved
 * rather than synthetically interpolated.
 */
export default function PriceHistoryPanel({
  observations = [],
  currency,
}: PriceHistoryPanelProps) {
  const dict = useDictionary();
  const t = dict.productV2;
  const { format } = useCurrency();

  const series = buildPriceHistorySeries(
    0,
    "",
    currency || "USD",
    observations,
  );

  if (!series || series.observations.length === 0) {
    return (
      <section className="rounded-card border border-line bg-white p-5">
        <h2 className="text-base font-bold text-ink">{t.priceHistory}</h2>
        <div className="mt-4 flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-canvas px-6 py-10 text-center">
          <span className="text-ink-muted" aria-hidden>
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 2.5v4M16 2.5v4" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-medium text-ink-soft">{t.historyEmpty}</p>
          <p className="mt-1 text-xs text-ink-muted">{t.historyNone}</p>
        </div>
      </section>
    );
  }

  // Calculate SVG timeline points
  const points = series.observations;
  const minP = series.minPrice;
  const maxP = series.maxPrice;
  const rangeP = maxP > minP ? maxP - minP : 1;

  const svgWidth = 480;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 24;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? svgWidth / 2
        : paddingX + (idx / (points.length - 1)) * (svgWidth - 2 * paddingX);
    const normalizedY = (p.itemPrice - minP) / rangeP;
    const y = svgHeight - paddingY - normalizedY * (svgHeight - 2 * paddingY);
    return { x, y, ...p };
  });

  const polylineStr = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{t.priceHistory}</h2>
        <span className="text-xs font-semibold text-brand">
          {points.length} observation{points.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-card border border-line bg-canvas p-3 text-center">
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-ink-muted">
            Lowest
          </span>
          <span className="text-sm font-bold text-ink">{format(series.minPrice)}</span>
        </div>
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-ink-muted">
            Highest
          </span>
          <span className="text-sm font-bold text-ink">{format(series.maxPrice)}</span>
        </div>
        <div>
          <span className="block text-[11px] uppercase tracking-wide text-ink-muted">
            Latest
          </span>
          <span className="text-sm font-bold text-brand">{format(series.latestPrice)}</span>
        </div>
      </div>

      {/* SVG Timeline Chart */}
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-44 w-full min-w-[320px]"
          fill="none"
        >
          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={svgWidth - paddingX}
            y2={paddingY}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />

          {/* Price line */}
          {coords.length > 1 && (
            <polyline
              points={polylineStr}
              fill="none"
              stroke="#bf481c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots */}
          {coords.map((c, i) => (
            <g key={c.id || i}>
              <circle
                cx={c.x}
                cy={c.y}
                r="4.5"
                fill="#ffffff"
                stroke="#bf481c"
                strokeWidth="2.5"
              />
              <title>{`${c.retailerName}: ${format(c.itemPrice)} on ${new Date(c.observedAt).toLocaleDateString()}`}</title>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Real price observations from participating retailers. Gaps indicate periods without active checks.
      </p>
    </section>
  );
}

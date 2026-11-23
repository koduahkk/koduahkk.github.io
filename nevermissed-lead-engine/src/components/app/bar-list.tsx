/**
 * Horizontal single-series bar list. One hue (--series-1), thin bars with a
 * 4px rounded data end, value printed at the tip in text ink, and a per-row
 * hover/focus tooltip with the full numbers. Rows are the table view too.
 */
import { cn } from "@/lib/utils";

export type BarRow = { label: string; value: number; display?: string; detail?: string };

export function BarList({ rows, max, className, ariaLabel }: { rows: BarRow[]; max?: number; className?: string; ariaLabel: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("space-y-2", className)} aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.label} tabIndex={0} className="group relative grid grid-cols-[minmax(7rem,34%)_1fr_auto] items-center gap-3 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${r.label}: ${r.display ?? r.value}${r.detail ? `, ${r.detail}` : ""}`}>
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="relative h-3.5">
            <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-series transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / top) * 100)}%` }} />
          </span>
          <span className="min-w-10 text-right font-medium tabular-nums">{r.display ?? r.value}</span>
          {r.detail ? (
            <span role="tooltip" className="pointer-events-none absolute -top-8 left-[34%] z-10 hidden whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow-md group-hover:block group-focus-visible:block">
              <strong>{r.label}</strong> · {r.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

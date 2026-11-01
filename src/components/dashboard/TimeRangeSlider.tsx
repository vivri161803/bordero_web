"use client";

import { Clock } from "lucide-react";
import { cx } from "./ui";

export type HourRange = [number, number];

/**
 * Slider a due cursori per scegliere una fascia oraria di partenza.
 * Il valore è [da, a) in ore intere: [11, 12] mostra le corse che partono dalle 11:00 alle 11:59.
 */
export default function TimeRangeSlider({
  min, max, value, onChange, histogram, nowHour,
}: {
  min: number;
  max: number;
  value: HourRange | null;
  onChange: (v: HourRange | null) => void;
  /** Numero di corse per ogni ora, indicizzato dall'ora (0–23). */
  histogram: number[];
  nowHour: number;
}) {
  const [from, to] = value ?? [min, max];
  const span = Math.max(1, max - min);
  const pct = (h: number) => ((h - min) / span) * 100;
  const peak = Math.max(1, ...histogram.slice(min, max));
  const inRangeCount = histogram.slice(from, to).reduce((a, b) => a + b, 0);

  const commit = (a: number, b: number) => {
    if (a <= min && b >= max) onChange(null);
    else onChange([a, b]);
  };

  const hours = Array.from({ length: span }, (_, i) => min + i);
  const tickEvery = span > 12 ? 3 : span > 6 ? 2 : 1;
  const canUseNow = nowHour >= min && nowHour < max;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
          <Clock className="h-3.5 w-3.5" /> Fascia di partenza
        </span>
        <div className="flex items-center gap-1">
          {canUseNow && (
            <button
              type="button"
              onClick={() => commit(nowHour, nowHour + 1)}
              className="min-h-8 rounded-md px-2 text-xs font-medium text-ink-2 hover:bg-panel-2 hover:text-ink"
            >
              Ora attuale
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="min-h-8 rounded-md px-2 text-xs font-medium text-ink-3 hover:bg-panel-2 hover:text-ink"
            >
              Tutto il giorno
            </button>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span className={cx("font-mono text-base font-semibold tnum", value ? "text-accent" : "text-ink")}>
          {String(from).padStart(2, "0")}:00 – {String(to - 1).padStart(2, "0")}:59
        </span>
        <span className="font-mono text-xs text-ink-3 tnum">
          {inRangeCount} {inRangeCount === 1 ? "corsa" : "corse"}
        </span>
      </div>

      {/* Istogramma: quante corse partono in ogni ora */}
      <div className="relative mt-2 flex h-8 items-end gap-px px-[13px]" aria-hidden>
        {hours.map((h) => {
          const n = histogram[h] ?? 0;
          const active = h >= from && h < to;
          return (
            <div key={h} className="flex h-full flex-1 items-end">
              <div
                className={cx(
                  "w-full rounded-t-[2px] transition-colors",
                  n === 0 ? "bg-transparent" : active ? "bg-accent/70" : "bg-panel-3",
                  h === nowHour && "outline outline-1 outline-ink-3",
                )}
                style={{ height: n === 0 ? 0 : `${Math.max(12, (n / peak) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="range-dual -mt-1">
        {/* Binario */}
        <div className="pointer-events-none absolute top-1/2 right-[13px] left-[13px] h-1 -translate-y-1/2 rounded-full bg-panel-3">
          <div
            className="absolute h-full rounded-full bg-accent"
            style={{ left: `${pct(from)}%`, right: `${100 - pct(to)}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={from}
          aria-label="Ora di inizio"
          aria-valuetext={`dalle ${from}:00`}
          onChange={(e) => commit(Math.min(Number(e.target.value), to - 1), to)}
          style={{ zIndex: from >= max - 1 ? 4 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={to}
          aria-label="Ora di fine"
          aria-valuetext={`fino alle ${to - 1}:59`}
          onChange={(e) => commit(from, Math.max(Number(e.target.value), from + 1))}
          style={{ zIndex: 3 }}
        />
      </div>

      <div className="relative -mt-1 h-4 font-mono text-[11px] text-ink-3 tnum" aria-hidden>
        {Array.from({ length: span + 1 }, (_, i) => min + i)
          .filter((h) => (h - min) % tickEvery === 0 || h === max)
          .map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2"
              style={{ left: `calc(13px + (100% - 26px) * ${pct(h) / 100})` }}
            >
              {h}
            </span>
          ))}
      </div>
    </div>
  );
}

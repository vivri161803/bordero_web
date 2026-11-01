"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cx } from "./ui";

export default function MultiSelectFilter({
  label, options, selected, onChange, format,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (v: Set<string>) => void;
  format?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const fmt = format ?? ((v: string) => v);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = search
    ? options.filter((o) => fmt(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const hasSelection = selected.size > 0;
  const summary = !hasSelection
    ? "Tutti"
    : selected.size === 1
      ? fmt([...selected][0])
      : `${selected.size} selezionati`;

  return (
    <div className="relative" ref={ref}>
      <span className="mb-1 block text-xs font-medium text-ink-3">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={cx(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm transition-colors",
          hasSelection ? "border-accent/60 bg-accent/10 text-ink" : "border-line bg-panel text-ink-2 hover:border-line-strong",
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="anim-pop-in absolute top-full left-0 z-40 mt-1 w-full min-w-[240px] overflow-hidden rounded-xl border border-line-strong bg-panel-2 shadow-2xl">
          {options.length > 6 && (
            <div className="border-b border-line p-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca…"
                  aria-label={`Cerca in ${label}`}
                  className="min-h-9 w-full rounded-md border border-line bg-panel pr-2 pl-8 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 border-b border-line px-2 py-1">
            <button type="button" onClick={() => onChange(new Set(filtered.length ? [...selected, ...filtered] : options))}
              className="min-h-8 rounded px-2 text-xs font-medium text-ink-2 hover:bg-panel-3 hover:text-ink">
              Seleziona {search ? "risultati" : "tutti"}
            </button>
            <button type="button" onClick={() => onChange(new Set())}
              className="min-h-8 rounded px-2 text-xs font-medium text-ink-3 hover:bg-panel-3 hover:text-ink">
              Nessuno
            </button>
          </div>
          <div role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-sm text-ink-3">Nessun risultato</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.has(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt)}
                    className={cx(
                      "flex min-h-10 w-full items-center gap-2.5 px-3 text-left text-sm transition-colors",
                      isSelected ? "bg-accent/10 text-ink" : "text-ink-2 hover:bg-panel-3",
                    )}
                  >
                    <span className={cx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                    )}>
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{fmt(opt)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

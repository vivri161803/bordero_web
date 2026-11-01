"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { STATO_INFO, type Urgency } from "@/lib/consegne";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ─── Badge stato ─── */
export function StatoBadge({ stato, size = "md" }: { stato: string; size?: "sm" | "md" }) {
  const label = STATO_INFO[stato];
  return (
    <span
      title={label ? `${stato} · ${label}` : stato || "Stato non indicato"}
      className={cx(
        "inline-flex items-center justify-center rounded-[4px] border font-mono font-semibold tracking-wide",
        "border-line-strong bg-panel-2 text-ink-2",
        stato === "INV" && "border-dashed",
        size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
      )}
    >
      {stato || "N/D"}
    </span>
  );
}

/* ─── Urgenza ─── */
export const URGENCY_STYLES: Record<Urgency, { dot: string; text: string; edge: string }> = {
  pronta: { dot: "bg-ok", text: "text-ok", edge: "bg-ok" },
  ritardo: { dot: "bg-late anim-late-pulse", text: "text-late", edge: "bg-late" },
  imminente: { dot: "bg-warn", text: "text-warn", edge: "bg-warn" },
  programmata: { dot: "bg-ink-3", text: "text-ink-3", edge: "bg-transparent" },
  sconosciuta: { dot: "bg-line-strong", text: "text-ink-3", edge: "bg-transparent" },
};

export function UrgencyLabel({ urgency, label, className }: { urgency: Urgency; label: string; className?: string }) {
  const s = URGENCY_STYLES[urgency];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", s.text, className)}>
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} aria-hidden />
      {label}
    </span>
  );
}

/* ─── Barra di avanzamento ─── */
export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const done = total > 0 && value === total;
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-panel-3", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label={`${value} su ${total} pronte`}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-500", done ? "bg-ok" : "bg-ink-2")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── Selettore a segmenti ─── */
export function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-lg border border-line bg-panel p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-panel-3 text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cx("font-mono text-xs tnum", active ? "text-ink-2" : "text-ink-3")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Chip filtro rapido ─── */
export function Chip({
  active, onClick, children, title,
}: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cx(
        "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-panel text-ink-2 hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/* ─── Modale ─── */
export function Modal({
  open, onClose, title, subtitle, icon, children, size = "md", tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  size?: "md" | "lg";
  tone?: "default" | "danger";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "anim-fade-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl outline-none sm:rounded-2xl",
          size === "lg" ? "sm:max-w-4xl" : "sm:max-w-md",
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          {icon && (
            <div
              className={cx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                tone === "danger" ? "border-late/30 bg-late/10 text-late" : "border-line bg-panel-2 text-ink-2",
              )}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && (
              <p className={cx("text-sm", tone === "danger" ? "text-late" : "text-ink-3")}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-3 hover:bg-panel-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-[#ffe23a] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-panel px-4 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-late px-4 text-sm font-semibold text-[#1d0000] transition-colors hover:bg-[#ff7d7d] disabled:cursor-not-allowed disabled:opacity-40",
  ghost:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink",
};

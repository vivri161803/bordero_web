"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, Download, LogOut, MoreHorizontal, RefreshCw, Trash2, Upload } from "lucide-react";
import { btn, cx } from "./ui";

export type LiveStatus = "connesso" | "connessione" | "offline";

function LiveIndicator({ status, lastUpdated, admins, guests }: {
  status: LiveStatus; lastUpdated: Date | null; admins: number; guests: number;
}) {
  const time = lastUpdated
    ? lastUpdated.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const label = status === "connesso" ? "In tempo reale" : status === "connessione" ? "Connessione…" : "Non connesso";
  return (
    <div className="flex items-center gap-2 text-xs text-ink-3" title={`${label} · ${admins} admin, ${guests} ospiti collegati`}>
      <span className={cx(
        "h-2 w-2 shrink-0 rounded-full",
        status === "connesso" ? "bg-ok" : status === "connessione" ? "bg-warn anim-late-pulse" : "bg-late",
      )} />
      <span className="hidden sm:inline">{label} ·</span>
      <span className="font-mono tnum">agg. {time}</span>
      <span className="hidden font-mono tnum md:inline">· {admins} admin · {guests} ospiti</span>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger, className }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm transition-colors",
        danger ? "text-late hover:bg-late/10" : "text-ink-2 hover:bg-panel-3 hover:text-ink",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default function Header({
  isGuest, isUploading, liveStatus, lastUpdated, admins, guests,
  onUpload, onExport, onStats, onReset, onLogout, canExport,
}: {
  isGuest: boolean;
  isUploading: boolean;
  liveStatus: LiveStatus;
  lastUpdated: Date | null;
  admins: number;
  guests: number;
  onUpload: () => void;
  onExport: () => void;
  onStats: () => void;
  onReset: () => void;
  onLogout: () => void;
  canExport: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">Borderò</span>
          <span className="hidden text-sm text-ink-3 sm:inline">Consegne</span>
        </div>
        {isGuest && (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs whitespace-nowrap text-ink-3">
            Solo lettura
          </span>
        )}
        <LiveIndicator status={liveStatus} lastUpdated={lastUpdated} admins={admins} guests={guests} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onStats} className={cx(btn.ghost, "hidden md:inline-flex")}>
          <BarChart3 className="h-4 w-4" /> Statistiche
        </button>
        <button type="button" onClick={onExport} disabled={!canExport} className={cx(btn.secondary, "hidden md:inline-flex")}>
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
        {!isGuest && (
          <button type="button" onClick={onUpload} disabled={isUploading} className={btn.primary}
            aria-label={isUploading ? "Caricamento in corso" : "Carica Excel"}>
            {isUploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="hidden sm:inline">{isUploading ? "Elaborazione…" : "Carica Excel"}</span>
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="Altre azioni"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-2 hover:border-line-strong hover:text-ink"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div role="menu" className="anim-pop-in absolute top-full right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line-strong bg-panel-2 py-1 shadow-2xl">
              <MenuItem icon={<BarChart3 className="h-4 w-4" />} label="Statistiche" onClick={run(onStats)} className="md:hidden" />
              {canExport && (
                <MenuItem icon={<Download className="h-4 w-4" />} label="Esporta CSV" onClick={run(onExport)} className="md:hidden" />
              )}
              <MenuItem icon={<LogOut className="h-4 w-4" />} label="Esci" onClick={run(onLogout)} />
              {!isGuest && (
                <>
                  <div className="my-1 border-t border-line" />
                  <MenuItem icon={<Trash2 className="h-4 w-4" />} label="Cancella tabella…" onClick={run(onReset)} danger />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

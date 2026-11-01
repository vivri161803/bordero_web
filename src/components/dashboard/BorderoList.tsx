"use client";

import { memo } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCheck, ChevronRight, FileSpreadsheet, RefreshCw, Undo2 } from "lucide-react";
import {
  formatPallet, formatSlot, friendlyDate, getUrgency, shortDate, urgencyLabel,
  type Consegna, type GroupedBordero,
} from "@/lib/consegne";
import { ProgressBar, StatoBadge, URGENCY_STYLES, UrgencyLabel, cx } from "./ui";

export type SortColumn = "orario" | "stato" | "bordero" | "name" | "consegna" | "avanzamento" | "pallet";
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<SortColumn, string> = {
  orario: "Orario di partenza",
  stato: "Stato",
  bordero: "Borderò",
  name: "Vettore",
  consegna: "Data consegna",
  avanzamento: "Avanzamento",
  pallet: "Pallet",
};

const GRID = "lg:grid-cols-[40px_64px_minmax(120px,1fr)_minmax(140px,1.3fr)_minmax(170px,1.2fr)_84px_minmax(120px,0.9fr)_64px]";

/* ─── Testo evidenziato ─── */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-accent/25 px-0.5 text-ink">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

/* ─── Intestazione colonne (solo desktop) ─── */
function HeaderCell({
  col, label, sort, dir, onSort, align = "left",
}: { col: SortColumn; label: string; sort: SortColumn; dir: SortDir; onSort: (c: SortColumn) => void; align?: "left" | "right" }) {
  const active = sort === col;
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <div className={cx(align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(col)}
        aria-label={`Ordina per ${SORT_LABELS[col]}${active ? (dir === "asc" ? ", crescente" : ", decrescente") : ""}`}
        className={cx(
          "inline-flex min-h-9 items-center gap-1 text-xs font-semibold tracking-wider uppercase transition-colors",
          active ? "text-ink" : "text-ink-3 hover:text-ink",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cx("h-3.5 w-3.5", active ? "text-accent" : "opacity-40")} />
      </button>
    </div>
  );
}

/* ─── Fermata ─── */
const FermataItem = memo(function FermataItem({
  fermata, isGuest, searchTerm, onToggle,
}: { fermata: Consegna; isGuest: boolean; searchTerm: string; onToggle: (f: Consegna) => void }) {
  const s = searchTerm.trim().toLowerCase();
  const isMatch = !!s && (fermata.descrizione?.toLowerCase().includes(s) || String(fermata.negozio) === s);
  const content = (
    <>
      <span
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          fermata.preparata ? "border-ok bg-ok text-[#04150d]" : "border-line-strong text-transparent",
          !isGuest && !fermata.preparata && "group-hover:border-ink-3",
        )}
        aria-hidden
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-[15px] font-medium", fermata.preparata ? "text-ink-2" : "text-ink")}>
          <Highlight text={fermata.descrizione} term={searchTerm.trim()} />
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
          <span className="font-mono tnum">
            {fermata.negozio ? <>#<Highlight text={String(fermata.negozio)} term={searchTerm.trim()} /></> : "Provincia"}
          </span>
          {fermata.provincia && fermata.negozio !== 0 && <span className="font-mono">{fermata.provincia}</span>}
          {fermata.note_consegna && <span className="truncate">{fermata.note_consegna}</span>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-mono text-lg font-semibold text-ink tnum">{formatPallet(Number(fermata.totale) || 0)}</span>
        <span className="ml-1 text-xs text-ink-3">plt</span>
      </span>
    </>
  );

  const cls = cx(
    "group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors min-h-14",
    fermata.preparata && "bg-ok/[0.05]",
    isMatch && "bg-accent/[0.07] shadow-[inset_3px_0_0_var(--color-accent)]",
  );

  if (isGuest) return <div className={cls}>{content}</div>;
  return (
    <button
      type="button"
      aria-pressed={fermata.preparata}
      aria-label={`${fermata.descrizione}${fermata.negozio ? ` (#${fermata.negozio})` : ""}: ${fermata.preparata ? "pronta, tocca per annullare" : "da preparare, tocca per segnare pronta"}`}
      onClick={() => onToggle(fermata)}
      className={cx(cls, "hover:bg-panel-2 active:bg-panel-3")}
    >
      {content}
    </button>
  );
});

/* ─── Riga borderò ─── */
const BorderoRow = memo(function BorderoRow({
  group, expanded, onToggleExpanded, isGuest, searchTerm, now, onToggleFermata, onToggleAll,
}: {
  group: GroupedBordero;
  expanded: boolean;
  onToggleExpanded: (b: string) => void;
  isGuest: boolean;
  searchTerm: string;
  now: number;
  onToggleFermata: (f: Consegna) => void;
  onToggleAll: (g: GroupedBordero) => void;
}) {
  const urgency = getUrgency(group, now);
  const uLabel = urgencyLabel(group, urgency, now);
  const edge = URGENCY_STYLES[urgency].edge;
  const panelId = `fermate-${group.bordero.replace(/\W+/g, "-")}`;
  const today = new Date(now);
  const pronteLabel = `${group.pronteCount}/${group.fermate.length}`;

  return (
    <li
      data-bordero={group.bordero}
      className={cx(
        "relative border-b border-line",
        expanded && "bg-panel",
        group.tuttePreparate && !expanded && "bg-ok/[0.03]",
      )}
    >
      <span className={cx("absolute top-0 bottom-0 left-0 w-[3px]", edge)} aria-hidden />

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => onToggleExpanded(group.bordero)}
        className="w-full text-left transition-colors hover:bg-panel-2/60"
      >
        {/* Mobile / tablet */}
        <div className="flex items-start gap-3 py-3 pr-4 pl-4 lg:hidden">
          <ChevronRight className={cx("mt-1 h-5 w-5 shrink-0 text-ink-3 transition-transform", expanded && "rotate-90")} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatoBadge stato={group.stato} size="sm" />
              <span className="truncate font-mono text-[15px] font-semibold text-ink">
                <Highlight text={group.borderoCode} term={searchTerm.trim()} />
              </span>
              <UrgencyLabel urgency={urgency} label={uLabel} />
            </div>
            <div className="mt-1 truncate text-[15px] text-ink-2">
              <Highlight text={group.name || "—"} term={searchTerm.trim()} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[13px] text-ink-3 tnum">
              <span><span className="font-sans">Carico</span> {friendlyDate(group.data_arrivo_carico, today)} · {formatSlot(group.ora_partenza)}</span>
              <span><span className="font-sans">Consegna</span> {shortDate(group.data_consegna)}</span>
            </div>
          </div>
          <div className="w-[76px] shrink-0 text-right">
            <div className="font-mono text-xl leading-tight font-semibold text-ink tnum">{formatPallet(group.totalePallet)}</div>
            <div className="text-xs text-ink-3">pallet</div>
            <div className={cx("mt-1 font-mono text-[13px] font-medium tnum", group.tuttePreparate ? "text-ok" : "text-ink-2")}>
              {pronteLabel}
            </div>
            <ProgressBar value={group.pronteCount} total={group.fermate.length} className="mt-1" />
          </div>
        </div>

        {/* Desktop */}
        <div className={cx("hidden min-h-14 items-center gap-3 py-2 pr-4 pl-3 lg:grid", GRID)}>
          <ChevronRight className={cx("h-5 w-5 justify-self-center text-ink-3 transition-transform", expanded && "rotate-90")} />
          <div><StatoBadge stato={group.stato} /></div>
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-semibold text-ink">
              <Highlight text={group.borderoCode} term={searchTerm.trim()} />
            </div>
            {group.borderoId && <div className="font-mono text-xs text-ink-3">ID {group.borderoId}</div>}
          </div>
          <div className="truncate text-[15px] text-ink-2"><Highlight text={group.name || "—"} term={searchTerm.trim()} /></div>
          <div className="min-w-0">
            <div className="font-mono text-sm text-ink tnum">
              <span className="text-ink-3">{friendlyDate(group.data_arrivo_carico, today)}</span>{" "}
              {formatSlot(group.ora_partenza)}
            </div>
            <UrgencyLabel urgency={urgency} label={uLabel} />
          </div>
          <div className="font-mono text-sm text-ink-2 tnum">{shortDate(group.data_consegna)}</div>
          <div className="flex items-center gap-2">
            <ProgressBar value={group.pronteCount} total={group.fermate.length} />
            <span className={cx("w-12 shrink-0 text-right font-mono text-sm tnum", group.tuttePreparate ? "text-ok" : "text-ink-2")}>
              {pronteLabel}
            </span>
          </div>
          <div className="text-right font-mono text-lg font-semibold text-ink tnum">{formatPallet(group.totalePallet)}</div>
        </div>
      </button>

      {expanded && (
        <div id={panelId} className="anim-fade-up pb-3 lg:pr-4 lg:pl-[52px]">
          <div className="mx-3 overflow-hidden rounded-xl border border-line bg-bg lg:mx-0">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
              <span className="text-sm text-ink-3">
                {group.fermate.length} {group.fermate.length === 1 ? "fermata" : "fermate"} ·{" "}
                <span className={group.tuttePreparate ? "text-ok" : "text-ink-2"}>{group.pronteCount} pronte</span>
              </span>
              {!isGuest && (
                <button
                  type="button"
                  onClick={() => onToggleAll(group)}
                  className={cx(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                    group.tuttePreparate
                      ? "border-line text-ink-3 hover:text-ink"
                      : "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20",
                  )}
                >
                  {group.tuttePreparate ? <Undo2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
                  {group.tuttePreparate ? "Annulla tutte" : "Segna tutte pronte"}
                </button>
              )}
            </div>
            <div className="divide-y divide-line">
              {group.fermate.map((f) => (
                <FermataItem key={f.id} fermata={f} isGuest={isGuest} searchTerm={searchTerm} onToggle={onToggleFermata} />
              ))}
            </div>
          </div>
        </div>
      )}
    </li>
  );
});

/* ─── Lista ─── */
export default function BorderoList({
  groups, expanded, onToggleExpanded, sort, dir, onSort, isGuest, searchTerm, now,
  onToggleFermata, onToggleAll, loading, emptyMessage,
}: {
  groups: GroupedBordero[];
  expanded: Set<string>;
  onToggleExpanded: (b: string) => void;
  sort: SortColumn;
  dir: SortDir;
  onSort: (c: SortColumn) => void;
  isGuest: boolean;
  searchTerm: string;
  now: number;
  onToggleFermata: (f: Consegna) => void;
  onToggleAll: (g: GroupedBordero) => void;
  loading: boolean;
  emptyMessage: string | null;
}) {
  const totFermate = groups.reduce((s, g) => s + g.fermate.length, 0);
  const totPronte = groups.reduce((s, g) => s + g.pronteCount, 0);
  const totPallet = groups.reduce((s, g) => s + g.totalePallet, 0);

  return (
    <div>
      {/* Intestazione colonne */}
      <div className={cx(
        "sticky top-14 z-10 hidden items-center gap-3 border-b border-line bg-bg/95 py-1 pr-4 pl-3 backdrop-blur lg:grid xl:top-0", GRID,
      )}>
        <span aria-hidden />
        <HeaderCell col="stato" label="Stato" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="bordero" label="Borderò" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="name" label="Vettore" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="orario" label="Partenza" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="consegna" label="Consegna" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="avanzamento" label="Pronte" sort={sort} dir={dir} onSort={onSort} />
        <HeaderCell col="pallet" label="Plt" sort={sort} dir={dir} onSort={onSort} align="right" />
      </div>

      {loading && groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-16 text-ink-3">
          <RefreshCw className="h-6 w-6 animate-spin" />
          Caricamento…
        </div>
      ) : emptyMessage ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-ink-3">
          <FileSpreadsheet className="h-10 w-10 opacity-40" />
          <p className="max-w-sm text-[15px]">{emptyMessage}</p>
        </div>
      ) : (
        <>
          <ul aria-label="Borderò">
          {groups.map((g) => (
            <BorderoRow
              key={g.bordero}
              group={g}
              expanded={expanded.has(g.bordero)}
              onToggleExpanded={onToggleExpanded}
              isGuest={isGuest}
              searchTerm={searchTerm}
              now={now}
              onToggleFermata={onToggleFermata}
              onToggleAll={onToggleAll}
            />
          ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line-strong bg-panel px-4 py-3 lg:sticky lg:bottom-0">
            <span className="text-sm text-ink-3">
              <span className="font-mono text-ink-2 tnum">{groups.length}</span> borderò ·{" "}
              <span className="font-mono text-ink-2 tnum">{totPronte}/{totFermate}</span> fermate pronte
            </span>
            <span>
              <span className="font-mono text-lg font-semibold text-ink tnum">{formatPallet(totPallet)}</span>
              <span className="ml-1 text-xs text-ink-3">plt</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

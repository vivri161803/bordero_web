"use client";

import { useEffect, useMemo, useRef } from "react";
import { Clock } from "lucide-react";
import {
  dateKey, formatMinutes, formatPallet, friendlyDate, getUrgency,
  type GroupedBordero, type Urgency,
} from "@/lib/consegne";
import { URGENCY_STYLES, cx } from "./ui";

type CarrierEntry = {
  name: string;
  groups: GroupedBordero[];
  fermate: number;
  pronte: number;
  pallet: number;
  urgency: Urgency;
};

type Slot = {
  key: string;
  date: string;
  start: number;
  end: number;
  startTs: number;
  groups: GroupedBordero[];
  carriers: CarrierEntry[];
  fermate: number;
  pronte: number;
  urgency: Urgency;
};

const URGENCY_RANK: Record<Urgency, number> = { ritardo: 0, imminente: 1, programmata: 2, sconosciuta: 3, pronta: 4 };

function worst(list: Urgency[]): Urgency {
  return list.reduce<Urgency>((acc, u) => (URGENCY_RANK[u] < URGENCY_RANK[acc] ? u : acc), "pronta");
}

function buildSlots(groups: GroupedBordero[], now: number): Slot[] {
  const map = new Map<string, Slot>();
  for (const g of groups) {
    if (g.startMinutes == null || g.startTs == null) continue;
    const date = g.data_arrivo_carico || g.data_consegna;
    const key = `${dateKey(date)}-${String(g.startMinutes).padStart(4, "0")}`;
    let slot = map.get(key);
    if (!slot) {
      const endMin = g.endTs != null ? g.startMinutes + Math.round((g.endTs - g.startTs) / 60_000) - 1 : g.startMinutes + 59;
      slot = { key, date, start: g.startMinutes, end: endMin, startTs: g.startTs, groups: [], carriers: [], fermate: 0, pronte: 0, urgency: "pronta" };
      map.set(key, slot);
    }
    slot.groups.push(g);
  }
  const slots = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const slot of slots) {
    const byCarrier = new Map<string, GroupedBordero[]>();
    for (const g of slot.groups) {
      const k = g.name || "N/D";
      const list = byCarrier.get(k);
      if (list) list.push(g);
      else byCarrier.set(k, [g]);
    }
    slot.carriers = [...byCarrier].map(([name, gs]) => ({
      name,
      groups: gs,
      fermate: gs.reduce((s, g) => s + g.fermate.length, 0),
      pronte: gs.reduce((s, g) => s + g.pronteCount, 0),
      pallet: gs.reduce((s, g) => s + g.totalePallet, 0),
      urgency: worst(gs.map((g) => getUrgency(g, now))),
    }));
    slot.fermate = slot.carriers.reduce((s, c) => s + c.fermate, 0);
    slot.pronte = slot.carriers.reduce((s, c) => s + c.pronte, 0);
    slot.urgency = worst(slot.carriers.map((c) => c.urgency));
  }
  return slots;
}

function sameSelection(selected: Set<string> | null, ids: string[]) {
  return !!selected && selected.size === ids.length && ids.every((b) => selected.has(b));
}

/* ─── Vista laterale (schermi larghi) ─── */
export function TimelineSidebar({
  groups, now, selected, onSelect,
}: {
  groups: GroupedBordero[];
  now: number;
  selected: Set<string> | null;
  onSelect: (ids: string[]) => void;
}) {
  const slots = useMemo(() => buildSlots(groups, now), [groups, now]);
  const multiDay = new Set(slots.map((s) => s.date)).size > 1;
  const nowIndex = slots.findIndex((s) => s.startTs > now);
  const today = new Date(now);

  if (slots.length === 0) {
    return <p className="text-sm text-ink-3">Nessun orario di partenza nei dati filtrati.</p>;
  }

  return (
    <ol className="relative">
      <span className="absolute top-2 bottom-2 left-[5px] w-px bg-line" aria-hidden />
      {slots.map((slot, i) => {
        const showDate = multiDay && (i === 0 || slots[i - 1].date !== slot.date);
        const ids = slot.groups.map((g) => g.bordero);
        return (
          <li key={slot.key} className="relative">
            {i === nowIndex && <NowMarker now={now} />}
            {showDate && (
              <div className="relative mt-3 mb-1 pl-6 text-xs font-semibold tracking-wider text-ink-3 uppercase">
                {friendlyDate(slot.date, today)}
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(ids)}
              aria-pressed={sameSelection(selected, ids)}
              className="group flex w-full items-center gap-3 py-1.5 text-left"
            >
              <span className={cx(
                "relative z-[1] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-bg",
                URGENCY_STYLES[slot.urgency].dot,
                slot.urgency === "programmata" && "bg-ink-3",
              )} />
              <span className={cx(
                "font-mono text-sm font-semibold tnum",
                sameSelection(selected, ids) ? "text-accent" : "text-ink group-hover:text-accent",
              )}>
                {formatMinutes(slot.start)}
              </span>
              <span className="font-mono text-xs text-ink-3 tnum">
                {slot.pronte}/{slot.fermate}
              </span>
            </button>
            <div className="space-y-1 pb-2 pl-6">
              {slot.carriers.map((c) => {
                const cIds = c.groups.map((g) => g.bordero);
                const active = sameSelection(selected, cIds);
                const pct = c.fermate > 0 ? Math.round((c.pronte / c.fermate) * 100) : 0;
                return (
                  <button
                    key={c.name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(cIds)}
                    className={cx(
                      "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                      active ? "border-accent bg-accent/10" : "border-line bg-panel hover:border-line-strong",
                    )}
                  >
                    <span className={cx("h-2 w-2 shrink-0 rounded-full", URGENCY_STYLES[c.urgency].dot)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">
                        {c.name}
                        {c.groups.length > 1 && <span className="ml-1 font-mono text-xs text-ink-3">×{c.groups.length}</span>}
                      </span>
                      <span className="block font-mono text-xs text-ink-3 tnum">
                        {c.fermate} fermate · {formatPallet(c.pallet)} plt
                      </span>
                    </span>
                    <span className={cx("font-mono text-xs tnum", pct === 100 ? "text-ok" : "text-ink-2")}>{pct}%</span>
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
      {nowIndex === -1 && <li><NowMarker now={now} /></li>}
    </ol>
  );
}

function NowMarker({ now }: { now: number }) {
  return (
    <div className="relative my-1 flex items-center gap-2" aria-label="Adesso">
      <span className="relative z-[1] h-[11px] w-[11px] rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/60" />
      <span className="font-mono text-xs font-semibold text-accent tnum">
        Adesso {formatMinutes(new Date(now).getHours() * 60 + new Date(now).getMinutes())}
      </span>
    </div>
  );
}

/* ─── Striscia orizzontale (tablet e telefono) ─── */
export function TimelineStrip({
  groups, now, selected, onSelect,
}: {
  groups: GroupedBordero[];
  now: number;
  selected: Set<string> | null;
  onSelect: (ids: string[]) => void;
}) {
  const slots = useMemo(() => buildSlots(groups, now), [groups, now]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  const nowIndex = slots.findIndex((s) => s.startTs + 60 * 60_000 > now);
  const today = new Date(now);
  const multiDay = new Set(slots.map((s) => s.date)).size > 1;

  // Al primo render porta in vista la fascia attuale
  useEffect(() => {
    if (didScroll.current || nowIndex < 0 || !scrollerRef.current) return;
    const el = scrollerRef.current.children[nowIndex] as HTMLElement | undefined;
    if (el) {
      scrollerRef.current.scrollLeft = Math.max(0, el.offsetLeft - 16);
      didScroll.current = true;
    }
  }, [nowIndex]);

  if (slots.length === 0) return null;

  return (
    <div ref={scrollerRef} className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
      {slots.map((slot) => {
        const ids = slot.groups.map((g) => g.bordero);
        const active = sameSelection(selected, ids);
        const s = URGENCY_STYLES[slot.urgency];
        return (
          <button
            key={slot.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(ids)}
            className={cx(
              "relative min-w-[104px] shrink-0 snap-start overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
              active ? "border-accent bg-accent/10" : "border-line bg-panel",
            )}
          >
            <span className={cx("absolute top-0 right-0 left-0 h-[3px]", s.edge)} aria-hidden />
            <span className={cx("block font-mono text-base font-semibold tnum", active ? "text-accent" : "text-ink")}>
              {formatMinutes(slot.start)}
            </span>
            {multiDay && <span className="block text-xs text-ink-3">{friendlyDate(slot.date, today)}</span>}
            <span className="block text-xs text-ink-3">
              {slot.groups.length} {slot.groups.length === 1 ? "corsa" : "corse"}
            </span>
            <span className={cx("block font-mono text-xs tnum", slot.pronte === slot.fermate ? "text-ok" : "text-ink-2")}>
              {slot.pronte}/{slot.fermate} pronte
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TimelineTitle() {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">
      <Clock className="h-4 w-4" /> Timeline partenze
    </h2>
  );
}

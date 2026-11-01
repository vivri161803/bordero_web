/* Tipi e funzioni di supporto condivise dalla dashboard. */

export type Consegna = {
  id: number;
  bordero: string;
  stato: string;
  data_arrivo_carico: string;
  ora_partenza: string;
  negozio: number;
  descrizione: string;
  data_consegna: string;
  name: string;
  data_preparazione: string | null;
  controllo: string;
  totale: number;
  preparata: boolean;
  provincia?: string | null;
  note_consegna?: string | null;
};

export type Urgency = "pronta" | "ritardo" | "imminente" | "programmata" | "sconosciuta";

export type GroupedBordero = {
  bordero: string;
  borderoCode: string;
  borderoId: string;
  stato: string;
  name: string;
  data_arrivo_carico: string;
  data_consegna: string;
  ora_partenza: string;
  fermate: Consegna[];
  totalePallet: number;
  pronteCount: number;
  tuttePreparate: boolean;
  /** Inizio e fine della fascia oraria di partenza, in ms (null se non leggibile). */
  startTs: number | null;
  endTs: number | null;
  /** Minuti dalla mezzanotte dell'inizio fascia (null se non leggibile). */
  startMinutes: number | null;
};

/* ─── Stati ─── */
export const STATO_INFO: Record<string, string> = {
  ACC: "Accettata",
  VAL: "Validata",
  CHI: "Chiusa",
  INV: "Invio per provincia",
};

/* ─── Date ─── */

/** "06/10/2026" → { d, m, y } oppure null. */
function parseItDate(s: string | null | undefined) {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return { d: Number(m[1]), mo: Number(m[2]), y };
}

/** Chiave ordinabile "20261006" per date in formato italiano. Le date non leggibili vanno in fondo. */
export function dateKey(s: string | null | undefined): string {
  const p = parseItDate(s);
  if (!p) return `9${s ?? ""}`;
  return `${p.y}${String(p.mo).padStart(2, "0")}${String(p.d).padStart(2, "0")}`;
}

export function compareItDates(a: string, b: string) {
  return dateKey(a).localeCompare(dateKey(b));
}

export function toItDate(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const WEEKDAYS = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** "06/10/2026" → "Oggi", "Domani", "Ieri" o "lun 06/10". */
export function friendlyDate(s: string, now: Date): string {
  const p = parseItDate(s);
  if (!p) return s || "—";
  const date = new Date(p.y, p.mo - 1, p.d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Domani";
  if (diff === -1) return "Ieri";
  return `${WEEKDAYS[date.getDay()]} ${String(p.d).padStart(2, "0")}/${String(p.mo).padStart(2, "0")}`;
}

export function shortDate(s: string): string {
  const p = parseItDate(s);
  if (!p) return s || "—";
  return `${String(p.d).padStart(2, "0")}/${String(p.mo).padStart(2, "0")}`;
}

/* ─── Fasce orarie ─── */

/** "16:00 - 16:59" → { start: 960, end: 1019 } (minuti dalla mezzanotte). */
export function parseSlot(s: string | null | undefined): { start: number; end: number } | null {
  if (!s) return null;
  const times = [...s.matchAll(/(\d{1,2})[:.](\d{2})/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (times.length === 0) return null;
  const start = times[0];
  const end = times.length > 1 ? times[1] : start + 59;
  return { start, end };
}

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "16:00 - 16:59" → "16:00–16:59" */
export function formatSlot(s: string): string {
  const p = parseSlot(s);
  if (!p) return s || "—";
  return `${formatMinutes(p.start)}–${formatMinutes(p.end)}`;
}

function slotTimestamps(dateStr: string, slot: string): { start: number; end: number } | null {
  const d = parseItDate(dateStr);
  const p = parseSlot(slot);
  if (!d || !p) return null;
  const base = new Date(d.y, d.mo - 1, d.d).getTime();
  return { start: base + p.start * 60_000, end: base + (p.end + 1) * 60_000 };
}

/* ─── Urgenza ─── */

export function getUrgency(g: GroupedBordero, now: number): Urgency {
  if (g.tuttePreparate) return "pronta";
  if (g.startTs == null || g.endTs == null) return "sconosciuta";
  if (now >= g.endTs) return "ritardo";
  if (g.startTs - now <= 60 * 60_000) return "imminente";
  return "programmata";
}

function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (h >= 24) return `${Math.floor(h / 24)} g`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function urgencyLabel(g: GroupedBordero, urgency: Urgency, now: number): string {
  switch (urgency) {
    case "pronta":
      return "Pronta";
    case "ritardo":
      return `In ritardo di ${formatDuration(now - (g.endTs ?? now))}`;
    case "imminente":
      return g.startTs != null && now >= g.startTs ? "In corso" : `Tra ${formatDuration((g.startTs ?? now) - now)}`;
    case "programmata":
      return `Tra ${formatDuration((g.startTs ?? now) - now)}`;
    default:
      return "Orario non indicato";
  }
}

/* ─── Borderò ─── */

/** "ID: 510279\nBORDERO: OD26008633" → { code: "OD26008633", id: "510279" } */
export function parseBordero(raw: string): { code: string; id: string } {
  if (!raw) return { code: "—", id: "" };
  const id = raw.match(/ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const code = raw.match(/BORDERO:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  if (!code && !id) return { code: raw.trim(), id: "" };
  return { code: code || id, id: code ? id : "" };
}

export function groupByBordero(rows: Consegna[]): GroupedBordero[] {
  const map = new Map<string, Consegna[]>();
  for (const row of rows) {
    const key = row.bordero || "__no_bordero__";
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  const groups: GroupedBordero[] = [];
  map.forEach((fermate, bordero) => {
    const first = fermate[0];
    // Solo la prima riga di una corsa ha data e ora: le cerchiamo comunque in tutte.
    const dataCarico = fermate.find((f) => f.data_arrivo_carico)?.data_arrivo_carico || "";
    const ora = fermate.find((f) => f.ora_partenza)?.ora_partenza || "";
    const totalePallet = fermate.reduce((sum, f) => sum + (Number(f.totale) || 0), 0);
    const pronteCount = fermate.filter((f) => f.preparata).length;
    const ts = slotTimestamps(dataCarico || first.data_consegna, ora);
    const { code, id } = parseBordero(bordero);
    groups.push({
      bordero,
      borderoCode: code,
      borderoId: id,
      stato: first.stato,
      name: first.name,
      data_arrivo_carico: dataCarico,
      data_consegna: first.data_consegna,
      ora_partenza: ora,
      fermate,
      totalePallet,
      pronteCount,
      tuttePreparate: fermate.length > 0 && pronteCount === fermate.length,
      startTs: ts?.start ?? null,
      endTs: ts?.end ?? null,
      startMinutes: parseSlot(ora)?.start ?? null,
    });
  });
  return groups;
}

/* ─── Numeri ─── */

export function formatPallet(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ",");
}

/* ─── CSV ─── */

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con separatore ";" e BOM, così si apre correttamente in Excel italiano. */
export function buildCsv(rows: Consegna[]): string {
  const headers = [
    "Borderò", "ID", "Stato", "Vettore", "Data carico", "Fascia partenza",
    "Data consegna", "Cod. negozio", "Negozio", "Provincia", "Pallet", "Pronta",
  ];
  const lines = rows.map((r) => {
    const { code, id } = parseBordero(r.bordero);
    return [
      code, id, r.stato, r.name, r.data_arrivo_carico, r.ora_partenza, r.data_consegna,
      r.negozio || "", r.descrizione, r.provincia ?? "", String(r.totale ?? "").replace(".", ","),
      r.preparata ? "Sì" : "No",
    ].map(csvCell).join(";");
  });
  return "﻿" + [headers.join(";"), ...lines].join("\r\n");
}

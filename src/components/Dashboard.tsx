"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, FileSpreadsheet, Info, Search, Trash2, X } from "lucide-react";
import { supabase, authHeaders } from "@/lib/supabase";
import {
  STATO_INFO, buildCsv, compareItDates, friendlyDate, getUrgency, groupByBordero, toItDate,
  type Consegna, type GroupedBordero,
} from "@/lib/consegne";
import Header, { type LiveStatus } from "./dashboard/Header";
import BorderoList, { SORT_LABELS, type SortColumn, type SortDir } from "./dashboard/BorderoList";
import MultiSelectFilter from "./dashboard/MultiSelectFilter";
import TimeRangeSlider, { type HourRange } from "./dashboard/TimeRangeSlider";
import { TimelineSidebar, TimelineStrip, TimelineTitle } from "./dashboard/Timeline";
import StatsModal from "./dashboard/StatsModal";
import { ToastViewport, useToasts } from "./dashboard/Toasts";
import { Chip, Modal, Segmented, btn, cx } from "./dashboard/ui";

type StatusFilter = "tutte" | "da_fare" | "ritardo" | "complete";

type ViewState = {
  negozio: string[];
  vettore: string[];
  dataCarico: string[];
  dataConsegna: string[];
  stato: string[];
  status: StatusFilter;
  timeRange: HourRange | null;
  sort: SortColumn;
  dir: SortDir;
  expanded: string[];
};

const VIEW_KEY = "bordero_view_v1";
const DEFAULT_VIEW: ViewState = {
  negozio: [], vettore: [], dataCarico: [], dataConsegna: [], stato: [],
  status: "tutte", timeRange: null, sort: "orario", dir: "asc", expanded: [],
};

function loadView(): ViewState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_VIEW;
    return { ...DEFAULT_VIEW, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VIEW;
  }
}

const negozioLabel = (d: Consegna) => (d.negozio ? `${d.negozio} – ${d.descrizione}` : `Provincia – ${d.descrizione}`);

function matchesSearch(g: GroupedBordero, s: string) {
  if (!s) return { group: true, fermata: false };
  const byGroup =
    g.bordero.toLowerCase().includes(s) || (g.name || "").toLowerCase().includes(s);
  const byFermata = g.fermate.some(
    (f) => (f.descrizione || "").toLowerCase().includes(s) || String(f.negozio) === s || (f.negozio && String(f.negozio).startsWith(s)),
  );
  return { group: byGroup || byFermata, fermata: byFermata };
}

function fermataMatches(f: Consegna, s: string) {
  return String(f.negozio) === s || (f.descrizione || "").toLowerCase().includes(s);
}

/* ═══════════════════════════════════════════ */
export default function Dashboard({ isGuest = false, onLogout }: { isGuest?: boolean; onLogout: () => void }) {
  const [data, setData] = useState<Consegna[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("connessione");
  const [onlineAdmins, setOnlineAdmins] = useState(0);
  const [onlineGuests, setOnlineGuests] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [initialView] = useState(loadView);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNegozio, setFilterNegozio] = useState(() => new Set(initialView.negozio));
  const [filterVettore, setFilterVettore] = useState(() => new Set(initialView.vettore));
  const [filterDataCarico, setFilterDataCarico] = useState(() => new Set(initialView.dataCarico));
  const [filterDataConsegna, setFilterDataConsegna] = useState(() => new Set(initialView.dataConsegna));
  const [filterStato, setFilterStato] = useState(() => new Set(initialView.stato));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialView.status);
  const [timeRange, setTimeRange] = useState<HourRange | null>(initialView.timeRange);
  const [sortColumn, setSortColumn] = useState<SortColumn>(initialView.sort);
  const [sortDir, setSortDir] = useState<SortDir>(initialView.dir);
  const [expanded, setExpanded] = useState(() => new Set(initialView.expanded));
  const [timelineSel, setTimelineSel] = useState<Set<string> | null>(null);

  const [showStats, setShowStats] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState("");
  const [uploadConflict, setUploadConflict] = useState<{ file: File; existing: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toasts, show: toast, dismiss } = useToasts();

  /* ─── Persistenza vista ─── */
  useEffect(() => {
    const view: ViewState = {
      negozio: [...filterNegozio], vettore: [...filterVettore], dataCarico: [...filterDataCarico],
      dataConsegna: [...filterDataConsegna], stato: [...filterStato], status: statusFilter,
      timeRange, sort: sortColumn, dir: sortDir, expanded: [...expanded],
    };
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch { /* storage non disponibile */ }
  }, [filterNegozio, filterVettore, filterDataCarico, filterDataConsegna, filterStato, statusFilter, timeRange, sortColumn, sortDir, expanded]);

  /* ─── Orologio (per urgenza e timeline) ─── */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  /* ─── Supabase ─── */
  const fetchData = useCallback(async () => {
    const { data: consegne, error } = await supabase
      .from("consegne").select("*").order("id", { ascending: true });
    if (error) {
      console.error("Errore fetch:", error);
    } else {
      setData((consegne as Consegna[]) || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchData, 350);
    };

    // Primo caricamento (fuori dal corpo sincrono dell'effetto)
    const initial = setTimeout(fetchData, 0);

    const channel = supabase
      .channel("consegne_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "consegne" }, scheduleRefetch)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("connesso");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLiveStatus("offline");
      });

    const presenceChannel = supabase.channel("online_presence", {
      config: { presence: { key: `${isGuest ? "guest" : "admin"}-${Math.random().toString(36).slice(2, 9)}` } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        let admins = 0;
        let guests = 0;
        Object.values(presenceChannel.presenceState()).forEach((list) => {
          (list as { role?: string }[]).forEach((p) => {
            if (p.role === "admin") admins++;
            else if (p.role === "guest") guests++;
          });
        });
        setOnlineAdmins(admins);
        setOnlineGuests(guests);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await presenceChannel.track({ role: isGuest ? "guest" : "admin" });
      });

    // Al ritorno sulla scheda ricarica i dati (utile su tablet in standby)
    const onVisible = () => { if (document.visibilityState === "visible") { setNow(Date.now()); scheduleRefetch(); } };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(initial);
      clearTimeout(refetchTimer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [isGuest, fetchData]);

  /* ─── Opzioni dei filtri ─── */
  const uniqueNegozi = useMemo(() => [...new Set(data.map(negozioLabel))].sort((a, b) => a.localeCompare(b, "it", { numeric: true })), [data]);
  const uniqueVettori = useMemo(() => [...new Set(data.map((d) => d.name).filter(Boolean))].sort(), [data]);
  const uniqueDataCarico = useMemo(() => [...new Set(data.map((d) => d.data_arrivo_carico).filter(Boolean))].sort(compareItDates), [data]);
  const uniqueDataConsegna = useMemo(() => [...new Set(data.map((d) => d.data_consegna).filter(Boolean))].sort(compareItDates), [data]);
  const uniqueStati = useMemo(() => [...new Set(data.map((d) => d.stato).filter(Boolean))].sort(), [data]);

  /* ─── Filtri ─── */
  const allGroups = useMemo(() => groupByBordero(data), [data]);
  const search = searchTerm.trim().toLowerCase();

  // Filtri per attributi (tutto tranne fascia oraria, stato preparazione e timeline)
  const baseGroups = useMemo(() => allGroups.filter((g) => {
    if (!matchesSearch(g, search).group) return false;
    if (filterVettore.size && !filterVettore.has(g.name)) return false;
    if (filterStato.size && !filterStato.has(g.stato)) return false;
    if (filterDataCarico.size && !filterDataCarico.has(g.data_arrivo_carico)) return false;
    if (filterDataConsegna.size && !filterDataConsegna.has(g.data_consegna)) return false;
    if (filterNegozio.size && !g.fermate.some((f) => filterNegozio.has(negozioLabel(f)))) return false;
    return true;
  }), [allGroups, search, filterVettore, filterStato, filterDataCarico, filterDataConsegna, filterNegozio]);

  // Estremi dello slider calcolati su tutte le corse
  const hourBounds = useMemo(() => {
    const mins = allGroups.map((g) => g.startMinutes).filter((m): m is number => m != null);
    if (mins.length === 0) return null;
    return { min: Math.floor(Math.min(...mins) / 60), max: Math.min(24, Math.floor(Math.max(...mins) / 60) + 1) };
  }, [allGroups]);

  // Fascia effettiva, ristretta agli estremi disponibili
  const effectiveRange = useMemo<HourRange | null>(() => {
    if (!timeRange || !hourBounds) return null;
    const a = Math.max(hourBounds.min, timeRange[0]);
    const b = Math.min(hourBounds.max, timeRange[1]);
    if (a >= b || (a <= hourBounds.min && b >= hourBounds.max)) return null;
    return [a, b];
  }, [timeRange, hourBounds]);

  const matchStatus = useCallback((g: GroupedBordero, s: StatusFilter) => {
    if (s === "da_fare") return !g.tuttePreparate;
    if (s === "complete") return g.tuttePreparate;
    if (s === "ritardo") return getUrgency(g, now) === "ritardo";
    return true;
  }, [now]);

  const histogram = useMemo(() => {
    const h = new Array(24).fill(0) as number[];
    baseGroups.forEach((g) => {
      if (g.startMinutes != null && matchStatus(g, statusFilter)) h[Math.floor(g.startMinutes / 60)]++;
    });
    return h;
  }, [baseGroups, matchStatus, statusFilter]);

  const timeGroups = useMemo(() => {
    if (!effectiveRange) return baseGroups;
    const [a, b] = effectiveRange;
    return baseGroups.filter((g) => g.startMinutes != null && g.startMinutes >= a * 60 && g.startMinutes < b * 60);
  }, [baseGroups, effectiveRange]);

  const statusCounts = useMemo(() => ({
    tutte: timeGroups.length,
    da_fare: timeGroups.filter((g) => !g.tuttePreparate).length,
    ritardo: timeGroups.filter((g) => getUrgency(g, now) === "ritardo").length,
    complete: timeGroups.filter((g) => g.tuttePreparate).length,
    imminenti: timeGroups.filter((g) => getUrgency(g, now) === "imminente").length,
  }), [timeGroups, now]);

  const timelineGroups = useMemo(() => timeGroups.filter((g) => matchStatus(g, statusFilter)), [timeGroups, matchStatus, statusFilter]);

  const visibleGroups = useMemo(() => {
    const list = timelineSel ? timelineGroups.filter((g) => timelineSel.has(g.bordero)) : [...timelineGroups];
    const dir = sortDir === "asc" ? 1 : -1;
    const tsOr = (g: GroupedBordero) => g.startTs ?? Number.MAX_SAFE_INTEGER;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "orario": cmp = tsOr(a) - tsOr(b); break;
        case "stato": cmp = (a.stato || "").localeCompare(b.stato || ""); break;
        case "bordero": cmp = a.borderoCode.localeCompare(b.borderoCode); break;
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "consegna": cmp = compareItDates(a.data_consegna, b.data_consegna); break;
        case "avanzamento": cmp = a.pronteCount / a.fermate.length - b.pronteCount / b.fermate.length; break;
        case "pallet": cmp = a.totalePallet - b.totalePallet; break;
      }
      // A parità, ordine per orario
      return cmp * dir || tsOr(a) - tsOr(b);
    });
    return list;
  }, [timelineGroups, timelineSel, sortColumn, sortDir]);

  const visibleRows = useMemo(() => visibleGroups.flatMap((g) => g.fermate), [visibleGroups]);

  /* ─── Filtri attivi ─── */
  const clearAllFilters = () => {
    setSearchTerm(""); setFilterNegozio(new Set()); setFilterVettore(new Set()); setFilterDataCarico(new Set());
    setFilterDataConsegna(new Set()); setFilterStato(new Set()); setTimelineSel(null); setTimeRange(null); setStatusFilter("tutte");
  };

  const removeFrom = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, v: string) =>
    () => setter((prev) => { const n = new Set(prev); n.delete(v); return n; });

  const today = useMemo(() => new Date(now), [now]);
  const activeTags: { key: string; label: string; onRemove: () => void }[] = [];
  filterNegozio.forEach((v) => activeTags.push({ key: `n-${v}`, label: `Negozio: ${v}`, onRemove: removeFrom(setFilterNegozio, v) }));
  filterVettore.forEach((v) => activeTags.push({ key: `v-${v}`, label: `Vettore: ${v}`, onRemove: removeFrom(setFilterVettore, v) }));
  filterDataCarico.forEach((v) => activeTags.push({ key: `dc-${v}`, label: `Carico: ${friendlyDate(v, today)}`, onRemove: removeFrom(setFilterDataCarico, v) }));
  filterDataConsegna.forEach((v) => activeTags.push({ key: `dk-${v}`, label: `Consegna: ${friendlyDate(v, today)}`, onRemove: removeFrom(setFilterDataConsegna, v) }));
  filterStato.forEach((v) => activeTags.push({ key: `s-${v}`, label: `Stato: ${v}`, onRemove: removeFrom(setFilterStato, v) }));
  if (effectiveRange) activeTags.push({
    key: "time",
    label: `Fascia: ${String(effectiveRange[0]).padStart(2, "0")}:00–${String(effectiveRange[1] - 1).padStart(2, "0")}:59`,
    onRemove: () => setTimeRange(null),
  });
  if (timelineSel) activeTags.push({
    key: "timeline",
    label: `Timeline: ${timelineSel.size} ${timelineSel.size === 1 ? "corsa" : "corse"}`,
    onRemove: () => setTimelineSel(null),
  });
  const anyFilter = activeTags.length > 0 || !!search || statusFilter !== "tutte";

  /* ─── Espansione ─── */
  const toggleExpanded = useCallback((b: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }, []);
  const allExpanded = visibleGroups.length > 0 && visibleGroups.every((g) => expanded.has(g.bordero));

  const onSearchChange = (value: string) => {
    setSearchTerm(value);
    const s = value.trim().toLowerCase();
    if (s.length < 2) return;
    // Apre automaticamente i borderò in cui la ricerca trova una fermata
    const hits = allGroups.filter((g) => g.fermate.some((f) => fermataMatches(f, s)));
    if (hits.length > 0 && hits.length <= 8) {
      setExpanded((prev) => new Set([...prev, ...hits.map((g) => g.bordero)]));
    }
  };

  const toggleTimeline = useCallback((ids: string[]) => {
    setTimelineSel((prev) => (prev && prev.size === ids.length && ids.every((b) => prev.has(b)) ? null : new Set(ids)));
  }, []);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(col); setSortDir("asc"); }
  };

  /* ─── Preparazione (con annulla) ─── */
  const setPreparata = useCallback(async (ids: number[], value: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setData((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, preparata: value } : r)));
    const { error } = await supabase.from("consegne").update({ preparata: value }).in("id", ids);
    if (error) {
      toast({ tone: "error", message: "Salvataggio non riuscito. Ricarico i dati." });
      fetchData();
    }
  }, [fetchData, toast]);

  const onToggleFermata = useCallback((f: Consegna) => {
    if (isGuest) return;
    setPreparata([f.id], !f.preparata);
  }, [isGuest, setPreparata]);

  const onToggleAll = useCallback((g: GroupedBordero) => {
    if (isGuest) return;
    const value = !g.tuttePreparate;
    const changed = g.fermate.filter((f) => f.preparata !== value).map((f) => f.id);
    setPreparata(changed, value);
    toast({
      tone: "success",
      message: value
        ? `${g.borderoCode}: ${changed.length} ${changed.length === 1 ? "fermata segnata" : "fermate segnate"} pronte`
        : `${g.borderoCode}: ${changed.length} fermate rimesse da preparare`,
      action: { label: "Annulla", onClick: () => setPreparata(changed, !value) },
    });
  }, [isGuest, setPreparata, toast]);

  // Ricerca rapida: Invio segna pronta l'unica fermata trovata
  const quickCandidates = useMemo(() => {
    if (isGuest || !search) return [];
    return visibleGroups.flatMap((g) => g.fermate.filter((f) => !f.preparata && fermataMatches(f, search)).map((f) => ({ f, g })));
  }, [isGuest, search, visibleGroups]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchTerm(""); return; }
    if (e.key !== "Enter" || isGuest || !search) return;
    e.preventDefault();
    if (quickCandidates.length === 1) {
      const { f, g } = quickCandidates[0];
      setPreparata([f.id], true);
      setSearchTerm("");
      toast({
        tone: "success",
        message: `Pronta: ${f.descrizione}${f.negozio ? ` #${f.negozio}` : ""} (${g.borderoCode})`,
        action: { label: "Annulla", onClick: () => setPreparata([f.id], false) },
      });
    } else if (quickCandidates.length > 1) {
      toast({ tone: "info", message: `${quickCandidates.length} fermate da preparare corrispondono: scegli dall'elenco.` });
    } else {
      toast({ tone: "info", message: "Nessuna fermata da preparare corrisponde alla ricerca." });
    }
  };

  // "/" mette il cursore nella ricerca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ─── Upload ─── */
  const uploadFile = useCallback(async (file: File, mode: "check" | "replace" | "skip" = "check") => {
    if (!/\.xlsx?$/i.test(file.name)) {
      toast({ tone: "error", message: "Formato non supportato: carica un file .xls o .xlsx." });
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", mode);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, headers: await authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.conflict) {
        setUploadConflict({ file, existing: body.existing, total: body.total });
        return;
      }
      if (!res.ok) throw new Error(body.error || "Errore durante il caricamento.");
      const parts = [`Caricate ${body.count} fermate da ${body.bordero} borderò`];
      if (body.replaced) parts.push(`${body.replaced} sostituiti`);
      if (body.skipped) parts.push(`${body.skipped} già presenti saltati`);
      toast({ tone: "success", message: parts.join(" · ") });
      await fetchData();
    } catch (err) {
      toast({ tone: "error", message: err instanceof Error ? err.message : "Errore durante il caricamento." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchData, toast]);

  // Trascina e rilascia il file in qualsiasi punto della pagina
  useEffect(() => {
    if (isGuest) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setDragActive(true); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragActive(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragActive(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) uploadFile(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [isGuest, uploadFile]);

  /* ─── Reset ed export ─── */
  const executeReset = async () => {
    setShowReset(false);
    setResetText("");
    try {
      const res = await fetch("/api/reset", { method: "POST", headers: await authHeaders() });
      if (!res.ok) throw new Error();
      setExpanded(new Set());
      setTimelineSel(null);
      toast({ tone: "success", message: "Tabella svuotata. Pronta per il prossimo turno." });
      await fetchData();
    } catch {
      toast({ tone: "error", message: "Errore durante la cancellazione." });
    }
  };

  const downloadCSV = () => {
    if (visibleRows.length === 0) return;
    const blob = new Blob([buildCsv(visibleRows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `consegne_${toItDate(new Date()).split("/").reverse().join("-")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast({ tone: "success", message: `Esportate ${visibleRows.length} fermate.` });
  };

  /* ─── Messaggio lista vuota ─── */
  const emptyMessage = visibleGroups.length > 0 ? null
    : data.length === 0
      ? (isGuest ? "In attesa che l'amministratore carichi i dati del turno." : "Nessun dato. Carica un file Excel con il pulsante in alto o trascinalo qui.")
      : statusFilter === "da_fare" && timeGroups.length > 0 ? "Tutte le corse sono pronte."
        : statusFilter === "ritardo" ? "Nessuna corsa in ritardo."
          : "Nessuna corsa corrisponde ai filtri attivi.";

  const dateChips = uniqueDataConsegna.slice(0, 6);
  const toggleDateChip = (d: string) => setFilterDataConsegna((prev) => {
    const n = new Set(prev);
    if (n.has(d)) n.delete(d); else n.add(d);
    return n;
  });

  /* ═══════════════════════════════════════════ */
  return (
    <div className="flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xls,.xlsx"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />

      <Header
        isGuest={isGuest}
        isUploading={isUploading}
        liveStatus={liveStatus}
        lastUpdated={lastUpdated}
        admins={onlineAdmins}
        guests={onlineGuests}
        onUpload={() => fileInputRef.current?.click()}
        onExport={downloadCSV}
        canExport={visibleRows.length > 0}
        onStats={() => setShowStats(true)}
        onReset={() => { setResetText(""); setShowReset(true); }}
        onLogout={onLogout}
      />

      <div className="flex flex-1 xl:overflow-hidden">
        <main className="min-w-0 flex-1 xl:overflow-y-auto">
          <section className="space-y-3 px-4 pt-4 pb-3" aria-label="Riepilogo e filtri">
            {/* Ricerca */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-ink-3" />
                <input
                  ref={searchRef}
                  type="search"
                  enterKeyHint={isGuest ? "search" : "done"}
                  autoComplete="off"
                  placeholder="Cerca borderò, negozio o vettore"
                  aria-label="Cerca borderò, negozio o vettore"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  className="min-h-11 w-full rounded-lg border border-line bg-panel pr-10 pl-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {searchTerm ? (
                  <button type="button" aria-label="Svuota ricerca" onClick={() => setSearchTerm("")}
                    className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-xs text-ink-3 lg:block">/</kbd>
                )}
              </div>
            </div>
            {quickCandidates.length === 1 && (
              <p className="-mt-1 text-sm text-ink-3">
                Premi <kbd className="rounded border border-line px-1 font-mono text-xs text-ink-2">Invio</kbd> per segnare pronta{" "}
                <span className="text-ink-2">{quickCandidates[0].f.descrizione}</span>
              </p>
            )}

            {/* Filtri avanzati */}
            {/* z-30: i menu a tendina devono restare sopra il pannello della fascia oraria */}
            <div id="filtri-avanzati" className="relative z-30 rounded-xl border border-line bg-panel p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MultiSelectFilter label="Negozio" options={uniqueNegozi} selected={filterNegozio} onChange={setFilterNegozio} />
                  <MultiSelectFilter label="Vettore" options={uniqueVettori} selected={filterVettore} onChange={setFilterVettore} />
                  <MultiSelectFilter label="Data carico" options={uniqueDataCarico} selected={filterDataCarico} onChange={setFilterDataCarico}
                    format={(v) => `${friendlyDate(v, today)}${friendlyDate(v, today).includes("/") ? "" : ` · ${v.slice(0, 5)}`}`} />
                  <MultiSelectFilter label="Stato" options={uniqueStati} selected={filterStato} onChange={setFilterStato}
                    format={(v) => (STATO_INFO[v] ? `${v} · ${STATO_INFO[v]}` : v)} />
                  {uniqueDataConsegna.length > dateChips.length && (
                    <MultiSelectFilter label="Data consegna" options={uniqueDataConsegna} selected={filterDataConsegna} onChange={setFilterDataConsegna} />
                  )}
                </div>
                <div className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-xs text-ink-3">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Stati: {Object.entries(STATO_INFO).map(([k, v]) => `${k} = ${v}`).join(" · ")}.
                    La barra colorata a sinistra di ogni corsa indica l&apos;urgenza: rossa in ritardo, arancione entro un&apos;ora, verde pronta.
                  </span>
                </div>
              </div>

            {/* Metà sinistra: completamento e data di consegna · metà destra: fascia di partenza */}
            <div className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-6">
              <div className="min-w-0 space-y-3">
                <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
                  <Segmented<StatusFilter>
                    label="Stato di preparazione"
                    fill
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "tutte", label: "Tutte", count: statusCounts.tutte },
                      { value: "da_fare", label: "Da fare", count: statusCounts.da_fare },
                      { value: "ritardo", label: "In ritardo", count: statusCounts.ritardo },
                      { value: "complete", label: "Pronte", count: statusCounts.complete },
                    ]}
                  />
                </div>
                {dateChips.length > 1 && (
                  <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
                    <span className="shrink-0 text-xs font-medium text-ink-3">Consegna</span>
                    {dateChips.map((d) => (
                      <Chip key={d} active={filterDataConsegna.has(d)} onClick={() => toggleDateChip(d)} title={d} className="flex-1 justify-center">
                        {friendlyDate(d, today)}
                        {!friendlyDate(d, today).includes("/") && <span className="font-mono text-xs opacity-70">{d.slice(0, 5)}</span>}
                      </Chip>
                    ))}
                  </div>
                )}
                {activeTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeTags.map((t) => (
                      <span key={t.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/40 bg-accent/10 py-0.5 pr-0.5 pl-2.5 text-sm text-ink">
                        <span className="truncate">{t.label}</span>
                        <button type="button" onClick={t.onRemove} aria-label={`Rimuovi filtro ${t.label}`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-accent/20 hover:text-ink">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {hourBounds && (
                <div className="rounded-xl border border-line bg-panel px-3 pt-2 pb-1">
                  <TimeRangeSlider
                    min={hourBounds.min}
                    max={hourBounds.max}
                    value={effectiveRange}
                    onChange={setTimeRange}
                    histogram={histogram}
                    nowHour={new Date(now).getHours()}
                  />
                </div>
              )}
            </div>

            {/* Timeline compatta (sotto i 1280px) */}
            {timelineGroups.length > 0 && (
              <div className="space-y-2 xl:hidden">
                <TimelineTitle />
                <TimelineStrip groups={timelineGroups} now={now} selected={timelineSel} onSelect={toggleTimeline} />
              </div>
            )}

            {/* Barra della lista */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-sm text-ink-3">
                <span className="font-mono text-ink tnum">{visibleGroups.length}</span> borderò ·{" "}
                <span className="font-mono text-ink tnum">{visibleRows.length}</span> fermate
                {anyFilter && (
                  <button type="button" onClick={clearAllFilters} className="ml-2 font-medium text-accent hover:underline">
                    Rimuovi filtri
                  </button>
                )}
              </p>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-2 text-sm text-ink-3 lg:hidden">
                  <span className="sr-only sm:not-sr-only">Ordina</span>
                  <select
                    value={`${sortColumn}:${sortDir}`}
                    onChange={(e) => { const [c, d] = e.target.value.split(":"); setSortColumn(c as SortColumn); setSortDir(d as SortDir); }}
                    className="min-h-10 rounded-lg border border-line bg-panel px-2 text-sm text-ink focus:border-accent focus:outline-none"
                  >
                    {(Object.keys(SORT_LABELS) as SortColumn[]).flatMap((c) => [
                      <option key={`${c}:asc`} value={`${c}:asc`}>{SORT_LABELS[c]} ↑</option>,
                      <option key={`${c}:desc`} value={`${c}:desc`}>{SORT_LABELS[c]} ↓</option>,
                    ])}
                  </select>
                </label>
                {visibleGroups.length > 0 && (
                  <button type="button" className={btn.ghost}
                    onClick={() => setExpanded(allExpanded ? new Set() : new Set(visibleGroups.map((g) => g.bordero)))}>
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="hidden sm:inline">{allExpanded ? "Chiudi tutti" : "Espandi tutti"}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <BorderoList
            groups={visibleGroups}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            sort={sortColumn}
            dir={sortDir}
            onSort={handleSort}
            isGuest={isGuest}
            searchTerm={searchTerm}
            now={now}
            onToggleFermata={onToggleFermata}
            onToggleAll={onToggleAll}
            loading={loading}
            emptyMessage={emptyMessage}
          />
          <div className="h-24 xl:h-6" aria-hidden />
        </main>

        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-panel/40 p-4 xl:block" aria-label="Timeline partenze">
          <div className="mb-3 flex items-center justify-between">
            <TimelineTitle />
            {timelineSel && (
              <button type="button" onClick={() => setTimelineSel(null)} className="text-xs font-medium text-accent hover:underline">
                Mostra tutte
              </button>
            )}
          </div>
          <TimelineSidebar groups={timelineGroups} now={now} selected={timelineSel} onSelect={toggleTimeline} />
        </aside>
      </div>

      {/* ── Statistiche ── */}
      <StatsModal open={showStats} onClose={() => setShowStats(false)} rows={visibleRows} />

      {/* ── Conferma cancellazione ── */}
      <Modal open={showReset} onClose={() => { setShowReset(false); setResetText(""); }}
        title="Cancella tabella" subtitle="Azione irreversibile" icon={<Trash2 className="h-5 w-5" />} tone="danger">
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (resetText === "cancella") executeReset(); }}>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Elimina definitivamente tutte le <span className="font-mono text-ink">{data.length}</span> fermate dal database,
            per tutti gli utenti. I dati del turno non potranno essere recuperati.
          </p>
          <label className="block text-sm text-ink-3">
            Per confermare scrivi <span className="font-mono font-semibold text-late">cancella</span>
            <input
              type="text"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-line bg-bg px-3 font-mono text-ink focus:border-late focus:outline-none"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { setShowReset(false); setResetText(""); }} className={btn.secondary}>Annulla</button>
            <button type="submit" disabled={resetText !== "cancella"} className={btn.danger}>Cancella tutto</button>
          </div>
        </form>
      </Modal>

      {/* ── Borderò già presenti ── */}
      <Modal open={!!uploadConflict} onClose={() => setUploadConflict(null)}
        title="Borderò già presenti" subtitle={uploadConflict?.file.name} icon={<FileSpreadsheet className="h-5 w-5" />}>
        {uploadConflict && (
          <div className="space-y-4 p-5">
            <p className="text-[15px] leading-relaxed text-ink-2">
              <span className="font-mono text-ink">{uploadConflict.existing}</span> borderò su{" "}
              <span className="font-mono text-ink">{uploadConflict.total}</span> di questo file sono già caricati.
              Ricaricarli così com&apos;è creerebbe righe doppie.
            </p>
            <div className="space-y-2">
              <button type="button" className={cx(btn.primary, "w-full justify-start py-2 text-left")}
                onClick={() => { const f = uploadConflict.file; setUploadConflict(null); uploadFile(f, "replace"); }}>
                <span>
                  <span className="block">Sostituisci i borderò esistenti</span>
                  <span className="block text-xs font-normal opacity-80">Aggiorna i dati, le fermate già pronte restano pronte</span>
                </span>
              </button>
              <button type="button" className={cx(btn.secondary, "w-full justify-start py-2 text-left")}
                onClick={() => { const f = uploadConflict.file; setUploadConflict(null); uploadFile(f, "skip"); }}>
                <span>
                  <span className="block">Aggiungi solo i nuovi</span>
                  <span className="block text-xs font-normal text-ink-3">
                    {uploadConflict.total - uploadConflict.existing} borderò nuovi, gli altri restano invariati
                  </span>
                </span>
              </button>
              <button type="button" className={cx(btn.ghost, "w-full")} onClick={() => setUploadConflict(null)}>Annulla</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Trascina file ── */}
      {dragActive && (
        <div className="anim-fade-in pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-bg/85 p-6">
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent p-10 text-center">
            <FileSpreadsheet className="h-10 w-10 text-accent" />
            <p className="text-lg font-semibold text-ink">Rilascia il file Excel per caricarlo</p>
            <p className="text-sm text-ink-3">.xls o .xlsx</p>
          </div>
        </div>
      )}

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

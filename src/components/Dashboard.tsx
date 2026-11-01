"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import {
  Upload, FileSpreadsheet, Search, Filter, RefreshCw,
  Download, Trash2, Check, ChevronDown, ChevronRight, ChevronUp, X, TrendingUp, Package, LogOut,
  MapPin, CheckCheck, ChevronsUpDown, EyeOff, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  Clock, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

/* ─── Types ─── */
type Consegna = {
  id: number;
  bordero: string;
  stato: string;
  data_arrivo_carico: string;
  ora_partenza: string;
  negozio: number;
  descrizione: string;
  data_consegna: string;
  name: string;
  data_preparazione: string;
  controllo: string;
  totale: number;
  preparata: boolean;
};

type GroupedBordero = {
  bordero: string;
  stato: string;
  name: string;
  data_arrivo_carico: string;
  data_consegna: string;
  ora_partenza: string;
  fermate: Consegna[];
  totalePallet: number;
  tuttePreparate: boolean;
  pronteCount: number;
};

type SortColumn = "stato" | "bordero" | "name" | "data_arrivo_carico" | "data_consegna" | "ora_partenza" | "fermate" | "pallet";
type SortDir = "asc" | "desc";

const CHART_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#f97316",
];

/* ─── Highlight helper ─── */
function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/30 text-amber-200 rounded-sm px-0.5">{text.slice(idx, idx + highlight.length)}</mark>
      {text.slice(idx + highlight.length)}
    </>
  );
}

/* ─── MultiSelectFilter ─── */
function MultiSelectFilter({
  label, options, selected, onChange,
}: {
  label: string; options: string[]; selected: Set<string>; onChange: (v: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(options));
  const deselectAll = () => onChange(new Set());

  const hasSelection = selected.size > 0;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
        {label}
      </label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`w-full flex items-center justify-between bg-white/5 border rounded-lg pl-3 pr-2 py-1.5 text-xs text-left cursor-pointer hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasSelection ? "border-blue-500/40 bg-blue-500/[0.07]" : "border-white/10"
        }`}
      >
        <span className={hasSelection ? "text-blue-300" : "text-white"}>
          {hasSelection ? `${selected.size} selezionat${selected.size === 1 ? "o" : "i"}` : "Tutti"}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
          open ? "rotate-180 text-blue-400" : "text-gray-400"
        }`} />
      </button>

      {open && (
        <div className="multiselect-dropdown absolute z-30 top-full mt-1 left-0 w-full min-w-[200px] bg-[#1e2128] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          {options.length > 5 && (
            <div className="p-2 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca..."
                  className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
          )}
          {/* Select All / Deselect All */}
          {!search && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
              >
                Seleziona tutti
              </button>
              <span className="text-white/10">•</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-[10px] text-gray-400 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
              >
                Deseleziona
              </button>
            </div>
          )}
          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-500 text-center">Nessun risultato</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.has(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors ${
                      isSelected
                        ? "text-blue-300 bg-blue-500/[0.08]"
                        : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all shrink-0 ${
                      isSelected
                        ? "bg-blue-500 border-blue-400"
                        : "bg-white/5 border-gray-600"
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="truncate">{opt}</span>
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

/* ─── StatCard ─── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="glass-card p-4 rounded-xl border border-white/5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} rounded-full blur-3xl -mr-8 -mt-8 opacity-20 transition-transform group-hover:scale-150`} />
      <h3 className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">{label}</h3>
      <p className="text-2xl font-bold text-white mt-1">
        {value}
        {sub && <span className="text-xs text-gray-400 font-normal ml-1">{sub}</span>}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════ */
export default function Dashboard({ isGuest = false, onLogout }: { isGuest?: boolean; onLogout: () => void }) {
  const [data, setData] = useState<Consegna[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterNegozio, setFilterNegozio] = useState<Set<string>>(new Set());
  const [filterVettore, setFilterVettore] = useState<Set<string>>(new Set());
  const [filterDataCarico, setFilterDataCarico] = useState<Set<string>>(new Set());
  const [filterDataConsegna, setFilterDataConsegna] = useState<Set<string>>(new Set());
  const [filterStato, setFilterStato] = useState<Set<string>>(new Set());
  const [onlineAdmins, setOnlineAdmins] = useState(0);
  const [onlineGuests, setOnlineGuests] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [expandedBordero, setExpandedBordero] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [timelineFilterBorderos, setTimelineFilterBorderos] = useState<Set<string> | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  /* ─── Supabase ─── */
  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("consegne_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "consegne" }, () => fetchData())
      .subscribe();

    // Canale di presenza per contare gli utenti collegati in tempo reale
    const presenceChannel = supabase.channel("online_presence", {
      config: {
        presence: {
          key: isGuest ? `guest-${Math.random().toString(36).substring(2, 9)}` : `admin-${Math.random().toString(36).substring(2, 9)}`,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        let admins = 0;
        let guests = 0;
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.role === "admin") admins++;
            else if (presence.role === "guest") guests++;
          });
        });
        setOnlineAdmins(admins);
        setOnlineGuests(guests);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            role: isGuest ? "guest" : "admin",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [isGuest]);

  const fetchData = async () => {
    setLoading(true);
    const { data: consegne, error } = await supabase
      .from("consegne").select("*").order("id", { ascending: true });
    if (error) console.error("Errore fetch:", error);
    else setData(consegne || []);
    setLoading(false);
  };

  /* ─── Unique filter options ─── */
  const uniqueNegozi = useMemo(() => [...new Set(data.map((d) => `${d.negozio} – ${d.descrizione}`))].sort(), [data]);
  const uniqueVettori = useMemo(() => [...new Set(data.map((d) => d.name).filter(Boolean))].sort(), [data]);
  const uniqueDataCarico = useMemo(() => [...new Set(data.map((d) => d.data_arrivo_carico).filter(Boolean))].sort(), [data]);
  const uniqueDataConsegna = useMemo(() => [...new Set(data.map((d) => d.data_consegna).filter(Boolean))].sort(), [data]);
  const uniqueStati = useMemo(() => [...new Set(data.map((d) => d.stato).filter(Boolean))].sort(), [data]);

  /* ─── Filtered data ─── */
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const s = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        item.bordero?.toLowerCase().includes(s) ||
        item.descrizione?.toLowerCase().includes(s) ||
        item.name?.toLowerCase().includes(s) ||
        String(item.negozio).includes(searchTerm);
      const matchNegozio = filterNegozio.size === 0 || filterNegozio.has(`${item.negozio} – ${item.descrizione}`);
      const matchVettore = filterVettore.size === 0 || filterVettore.has(item.name);
      const matchDataCarico = filterDataCarico.size === 0 || filterDataCarico.has(item.data_arrivo_carico);
      const matchDataConsegna = filterDataConsegna.size === 0 || filterDataConsegna.has(item.data_consegna);
      const matchStato = filterStato.size === 0 || filterStato.has(item.stato);
      const matchTimeline = !timelineFilterBorderos || timelineFilterBorderos.has(item.bordero);
      return matchSearch && matchNegozio && matchVettore && matchDataCarico && matchDataConsegna && matchStato && matchTimeline;
    });
  }, [data, searchTerm, filterNegozio, filterVettore, filterDataCarico, filterDataConsegna, filterStato, timelineFilterBorderos]);

  const activeFilterCount = filterNegozio.size + filterVettore.size + filterDataCarico.size + filterDataConsegna.size + filterStato.size + (timelineFilterBorderos ? 1 : 0);
  const clearAllFilters = () => { setSearchTerm(""); setFilterNegozio(new Set()); setFilterVettore(new Set()); setFilterDataCarico(new Set()); setFilterDataConsegna(new Set()); setFilterStato(new Set()); setTimelineFilterBorderos(null); };

  /* ─── Active filter tags helper ─── */
  const activeFilterTags = useMemo(() => {
    const tags: { label: string; value: string; onRemove: () => void }[] = [];
    filterNegozio.forEach((v) => tags.push({ label: "Negozio", value: v, onRemove: () => setFilterNegozio((prev) => { const n = new Set(prev); n.delete(v); return n; }) }));
    filterVettore.forEach((v) => tags.push({ label: "Vettore", value: v, onRemove: () => setFilterVettore((prev) => { const n = new Set(prev); n.delete(v); return n; }) }));
    filterDataCarico.forEach((v) => tags.push({ label: "Data Carico", value: v, onRemove: () => setFilterDataCarico((prev) => { const n = new Set(prev); n.delete(v); return n; }) }));
    filterDataConsegna.forEach((v) => tags.push({ label: "Data Cons.", value: v, onRemove: () => setFilterDataConsegna((prev) => { const n = new Set(prev); n.delete(v); return n; }) }));
    filterStato.forEach((v) => tags.push({ label: "Stato", value: v, onRemove: () => setFilterStato((prev) => { const n = new Set(prev); n.delete(v); return n; }) }));
    return tags;
  }, [filterNegozio, filterVettore, filterDataCarico, filterDataConsegna, filterStato]);

  /* ─── Grouped data ─── */
  const groupedData = useMemo(() => {
    const map = new Map<string, Consegna[]>();
    filteredData.forEach((row) => {
      const key = row.bordero || "__no_bordero__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    let groups: GroupedBordero[] = [];
    map.forEach((fermate, bordero) => {
      const first = fermate[0];
      const totalePallet = fermate.reduce((sum, f) => sum + (f.totale || 0), 0);
      const pronteCount = fermate.filter((f) => f.preparata).length;
      groups.push({
        bordero,
        stato: first.stato,
        name: first.name,
        data_arrivo_carico: first.data_arrivo_carico,
        data_consegna: first.data_consegna,
        ora_partenza: first.ora_partenza,
        fermate,
        totalePallet,
        tuttePreparate: pronteCount === fermate.length,
        pronteCount,
      });
    });

    // (6) Hide completed groups
    if (hideCompleted) {
      groups = groups.filter((g) => !g.tuttePreparate);
    }

    // (3) Sorting
    if (sortColumn) {
      const dir = sortDir === "asc" ? 1 : -1;
      groups.sort((a, b) => {
        let cmp = 0;
        switch (sortColumn) {
          case "stato": cmp = (a.stato || "").localeCompare(b.stato || ""); break;
          case "bordero": cmp = (a.bordero || "").localeCompare(b.bordero || ""); break;
          case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
          case "data_arrivo_carico": cmp = (a.data_arrivo_carico || "").localeCompare(b.data_arrivo_carico || ""); break;
          case "data_consegna": cmp = (a.data_consegna || "").localeCompare(b.data_consegna || ""); break;
          case "ora_partenza": cmp = (a.ora_partenza || "").localeCompare(b.ora_partenza || ""); break;
          case "fermate": cmp = a.fermate.length - b.fermate.length; break;
          case "pallet": cmp = a.totalePallet - b.totalePallet; break;
        }
        return cmp * dir;
      });
    }

    return groups;
  }, [filteredData, sortColumn, sortDir, hideCompleted]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  const toggleExpanded = (bordero: string) => {
    setExpandedBordero((prev) => {
      const next = new Set(prev);
      if (next.has(bordero)) next.delete(bordero);
      else next.add(bordero);
      return next;
    });
  };

  const expandAll = () => setExpandedBordero(new Set(groupedData.map((g) => g.bordero)));
  const collapseAll = () => setExpandedBordero(new Set());
  const allExpanded = groupedData.length > 0 && expandedBordero.size >= groupedData.length;

  /* ─── Timeline filter toggle ─── */
  const timelineAnimKey = useRef(0);
  const toggleTimelineFilter = useCallback((borderos: string[]) => {
    timelineAnimKey.current += 1;
    setTimelineFilterBorderos((prev) => {
      // If the same filter is active, clear it (toggle off)
      if (prev && borderos.every((b) => prev.has(b)) && prev.size === borderos.length) {
        return null;
      }
      return new Set(borderos);
    });
  }, []);

  /* ─── Chart data ─── */
  const chartPalletPerVettore = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((d) => { const k = d.name || "N/A"; map.set(k, (map.get(k) || 0) + (d.totale || 0)); });
    return Array.from(map, ([name, pallet]) => ({ name, pallet: +pallet.toFixed(1) })).sort((a, b) => b.pallet - a.pallet).slice(0, 12);
  }, [filteredData]);

  const chartStatoPie = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((d) => { const k = d.stato || "N/A"; map.set(k, (map.get(k) || 0) + 1); });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filteredData]);

  const chartPreparataPie = useMemo(() => {
    const pronte = filteredData.filter((d) => d.preparata).length;
    return [{ name: "Pronte", value: pronte }, { name: "Da preparare", value: filteredData.length - pronte }];
  }, [filteredData]);

  const chartPalletPerData = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.forEach((d) => { const k = d.data_consegna || "N/A"; map.set(k, (map.get(k) || 0) + (d.totale || 0)); });
    return Array.from(map, ([data, pallet]) => ({ data, pallet: +pallet.toFixed(1) })).sort((a, b) => a.data.localeCompare(b.data));
  }, [filteredData]);

  /* ─── Handlers ─── */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || "Errore upload"); }
      await fetchData();
    } catch (error: any) { console.error("Upload error:", error); alert(error.message); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const togglePreparata = async (id: number, cur: boolean) => {
    if (isGuest) return;
    setData(data.map((i) => (i.id === id ? { ...i, preparata: !cur } : i)));
    const { error } = await supabase.from("consegne").update({ preparata: !cur }).eq("id", id);
    if (error) fetchData();
  };

  const toggleAllPreparate = async (fermate: Consegna[], setTo: boolean) => {
    if (isGuest) return;
    const ids = fermate.map((f) => f.id);
    // Optimistic update
    setData((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, preparata: setTo } : i));
    const { error } = await supabase.from("consegne").update({ preparata: setTo }).in("id", ids);
    if (error) fetchData();
  };

  const executeReset = async () => {
    setLoading(true);
    setShowResetModal(false);
    setResetConfirmText("");
    try {
      await fetch("/api/reset", { method: "POST" });
      await fetchData();
    } catch {
      alert("Errore durante il reset.");
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (filteredData.length === 0) return;
    const headers = Object.keys(filteredData[0]).join(",");
    const rows = filteredData.map((r) => Object.values(r).map((v) => `"${v}"`).join(","));
    const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `consegne_${new Date().toISOString().split("T")[0]}.csv`; a.click();
  };

  /* ─── Metrics ─── */
  const totPallet = filteredData.reduce((a, i) => a + (i.totale || 0), 0);
  const viaggiUnici = new Set(filteredData.map((i) => i.bordero)).size;
  const pronteCount = filteredData.filter((d) => d.preparata).length;
  const prontePercent = filteredData.length > 0 ? Math.round((pronteCount / filteredData.length) * 100) : 0;

  const tooltipStyle = { background: "#1e2128", border: "1px solid #333842", borderRadius: 8 };

  /* ═══════════════════════════════════════════ */
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── HEADER ── */}
      <header className="shrink-0 glass border-b border-white/5 px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-blue-400" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              Dashboard Consegne
            </h1>
            {isGuest && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 border border-white/10 text-gray-400 whitespace-nowrap">
                Ospite (Solo Lettura)
              </span>
            )}
            <div className="flex items-center gap-1.5 ml-2 text-[10px] text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>{onlineAdmins} Admin</span>
              <span className="text-white/10">•</span>
              <span>{onlineGuests} {onlineGuests === 1 ? "Ospite" : "Ospiti"}</span>
              <span className="text-gray-500 ml-1 font-medium">(max 200)</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xls,.xlsx" onChange={handleFileUpload} />
          {!isGuest && (
            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
              className="glass hover:bg-white/10 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all">
              {isUploading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {isUploading ? "Elaborazione..." : "Carica Excel"}
            </button>
          )}
          <button onClick={downloadCSV}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all shadow-[0_0_12px_rgba(37,99,235,0.3)]">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {!isGuest && (
            <button onClick={() => { setResetConfirmText(""); setShowResetModal(true); }}
              className="bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/40 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all">
              <Trash2 className="w-4 h-4" /> Cancella Tabella
            </button>
          )}
          <button onClick={onLogout}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all">
            <LogOut className="w-4 h-4" /> Esci
          </button>
        </div>
      </header>

      {/* ── MAIN: 2 colonne ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ════════ COLONNA SINISTRA: filtri + tabella ════════ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Barra filtri */}
          <div className="shrink-0 px-5 pt-4 pb-3 space-y-3 border-b border-white/5">
            {/* Search + reset */}
            <div className="flex items-end gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input type="text" placeholder="Cerca borderò, negozio, vettore..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors whitespace-nowrap">
                  <X className="w-3 h-3" /> Reset ({activeFilterCount})
                </button>
              )}
            </div>
            {/* Dropdown row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MultiSelectFilter label="Negozio" options={uniqueNegozi} selected={filterNegozio} onChange={setFilterNegozio} />
              <MultiSelectFilter label="Vettore" options={uniqueVettori} selected={filterVettore} onChange={setFilterVettore} />
              <MultiSelectFilter label="Data Carico" options={uniqueDataCarico} selected={filterDataCarico} onChange={setFilterDataCarico} />
              <MultiSelectFilter label="Data Consegna" options={uniqueDataConsegna} selected={filterDataConsegna} onChange={setFilterDataConsegna} />
              <MultiSelectFilter label="Stato" options={uniqueStati} selected={filterStato} onChange={setFilterStato} />
            </div>
            {/* Active filter tags */}
            {activeFilterTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {activeFilterTags.map((tag, idx) => (
                  <span
                    key={`${tag.label}-${tag.value}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-in fade-in zoom-in-95 duration-200"
                  >
                    <span className="text-blue-400/60">{tag.label}:</span>
                    <span className="max-w-[120px] truncate">{tag.value}</span>
                    <button
                      type="button"
                      onClick={tag.onRemove}
                      className="ml-0.5 w-3.5 h-3.5 rounded-full bg-blue-500/20 hover:bg-blue-500/40 flex items-center justify-center transition-colors"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                ))}
                {timelineFilterBorderos && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 animate-in fade-in zoom-in-95 duration-200">
                    <Clock className="w-2.5 h-2.5 text-cyan-400/60" />
                    <span>Timeline: {timelineFilterBorderos.size} {timelineFilterBorderos.size === 1 ? "corsa" : "corse"}</span>
                    <button
                      type="button"
                      onClick={() => setTimelineFilterBorderos(null)}
                      className="ml-0.5 w-3.5 h-3.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 flex items-center justify-center transition-colors"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[10px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded-md hover:bg-red-500/10 transition-colors"
                >
                  Rimuovi tutti
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Filter className="w-3.5 h-3.5" />
                <>{groupedData.length} borderò ({filteredData.length} fermate totali)</>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle nascondi completate */}
                <button
                  onClick={() => setHideCompleted((h) => !h)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                    hideCompleted
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-white/5 text-gray-400 border-white/10 hover:text-gray-200"
                  }`}
                >
                  {hideCompleted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {hideCompleted ? "Mostra tutte" : "Solo da completare"}
                </button>
                {/* Expand/Collapse all */}
                {groupedData.length > 0 && (
                  <button
                    onClick={allExpanded ? collapseAll : expandAll}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-gray-400 border border-white/10 hover:text-gray-200 transition-all"
                  >
                    <ChevronsUpDown className="w-3 h-3" />
                    {allExpanded ? "Chiudi tutti" : "Espandi tutti"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabella scrollabile */}
          <div className="flex-1 overflow-auto" ref={tableScrollRef}>
              {/* ═══ VISTA RAGGRUPPATA PER BORDERÒ ═══ */}
              <>
                {/* ── Desktop table (hidden on mobile) ── */}
                <table className="w-full text-left text-sm whitespace-nowrap hidden md:table table-fixed">
                  <thead className="bg-black/40 text-gray-300 uppercase font-semibold text-xs tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="p-3 w-10"></th>
                      <th className="p-3 w-[70px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("stato")}>
                        <span className="inline-flex items-center gap-1">Stato <SortIcon col="stato" /></span>
                      </th>
                      <th className="p-3 min-w-[140px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("bordero")}>
                        <span className="inline-flex items-center gap-1">Borderò <SortIcon col="bordero" /></span>
                      </th>
                      <th className="p-3 min-w-[160px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>
                        <span className="inline-flex items-center gap-1">Vettore <SortIcon col="name" /></span>
                      </th>
                      <th className="p-3 w-[100px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("data_arrivo_carico")}>
                        <span className="inline-flex items-center gap-1">Data Carico <SortIcon col="data_arrivo_carico" /></span>
                      </th>
                      <th className="p-3 w-[100px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("data_consegna")}>
                        <span className="inline-flex items-center gap-1">Data Cons. <SortIcon col="data_consegna" /></span>
                      </th>
                      <th className="p-3 w-[100px] cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("ora_partenza")}>
                        <span className="inline-flex items-center gap-1">Ora Part. <SortIcon col="ora_partenza" /></span>
                      </th>
                      <th className="p-3 w-[130px] text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("fermate")}>
                        <span className="inline-flex items-center gap-1">Avanzamento <SortIcon col="fermate" /></span>
                      </th>
                      <th className="p-3 w-[70px] text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("pallet")}>
                        <span className="inline-flex items-center gap-1 justify-end">Pallet <SortIcon col="pallet" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody key={timelineAnimKey.current} className="divide-y divide-white/5 timeline-filter-animate">
                    {loading && data.length === 0 ? (
                      <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 opacity-50" />Caricamento...
                      </td></tr>
                    ) : groupedData.length === 0 ? (
                      <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        {data.length === 0
                          ? (isGuest ? "In attesa che l'amministratore carichi i dati del turno." : "Carica un file Excel per iniziare.")
                          : hideCompleted ? "Tutte le corse sono completate! 🎉" : "Nessun risultato con i filtri attivi."}
                      </td></tr>
                    ) : (
                      groupedData.map((group, groupIdx) => {
                        const isExpanded = expandedBordero.has(group.bordero);
                        const fermatePct = group.fermate.length > 0 ? Math.round((group.pronteCount / group.fermate.length) * 100) : 0;
                        return (
                          <Fragment key={group.bordero}>
                            {/* ── Riga raggruppata ── */}
                            <tr
                              data-bordero={group.bordero}
                              onClick={() => toggleExpanded(group.bordero)}
                              className={`cursor-pointer transition-all select-none ${
                                group.tuttePreparate ? "bg-emerald-900/10" :
                                groupIdx % 2 === 1 ? "bg-white/[0.015]" : ""
                              } ${
                                isExpanded ? "bg-white/[0.04]" : "hover:bg-white/5"
                              }`}
                            >
                              <td className="p-3 text-center">
                                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                  isExpanded ? "rotate-90" : ""
                                }`} />
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  group.stato === "ACC" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                                  group.stato === "CHI" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                                  group.stato === "VAL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                                  group.stato === "INV" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                                  "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                                }`}>{group.stato || "N/A"}</span>
                              </td>
                              <td className="p-3 font-mono text-[13px] text-gray-200 truncate">{group.bordero?.replace("ID: ", "").replace("\nBORDERO:", "") || "-"}</td>
                              <td className="p-3 text-gray-200 text-[13px] truncate">{group.name}</td>
                              <td className="p-3 text-gray-300 text-[13px]">{group.data_arrivo_carico}</td>
                              <td className="p-3 text-gray-300 text-[13px]">{group.data_consegna}</td>
                              <td className="p-3 text-gray-300 text-[13px]">{group.ora_partenza}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-[width] duration-500 ${
                                        group.tuttePreparate ? "bg-emerald-400" :
                                        group.pronteCount > 0 ? "bg-gradient-to-r from-amber-500 to-amber-400" : "bg-white/10"
                                      }`}
                                      style={{ width: `${fermatePct}%` }}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${
                                    group.tuttePreparate ? "text-emerald-400" :
                                    group.pronteCount > 0 ? "text-amber-400" : "text-gray-500"
                                  }`}>
                                    {group.pronteCount}/{group.fermate.length}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold text-white text-[15px]">{group.totalePallet % 1 === 0 ? group.totalePallet : group.totalePallet.toFixed(1)}</td>
                            </tr>

                            {/* ── Accordion: card fermate ── */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="p-0">
                                  <div className="accordion-content">
                                    <div className="mx-4 my-3 rounded-xl glass-card border border-white/5 overflow-hidden">
                                      {/* Header card */}
                                      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <MapPin className="w-3.5 h-3.5 text-blue-400" />
                                          <span className="text-[13px] font-semibold text-gray-200">
                                            {group.fermate.length} {group.fermate.length === 1 ? "fermata" : "fermate"}
                                          </span>
                                        </div>
                                        {/* (1) Segna tutto pronto / deseleziona */}
                                        {!isGuest && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleAllPreparate(group.fermate, !group.tuttePreparate); }}
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                              group.tuttePreparate
                                                ? "bg-gray-500/15 text-gray-400 hover:bg-gray-500/25 border border-gray-500/20"
                                                : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                            }`}
                                          >
                                            <CheckCheck className="w-3 h-3" />
                                            {group.tuttePreparate ? "Deseleziona tutto" : "Segna tutto pronto"}
                                          </button>
                                        )}
                                      </div>
                                      {/* Fermate list */}
                                      <div className="divide-y divide-white/[0.03]">
                                        {group.fermate.map((fermata) => {
                                          const isSearchMatch = searchTerm && (
                                            fermata.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            String(fermata.negozio).includes(searchTerm)
                                          );
                                          return (
                                            <div
                                              key={fermata.id}
                                              className={`flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
                                                fermata.preparata ? "bg-emerald-900/[0.06]" : ""
                                              } ${
                                                isSearchMatch ? "ring-1 ring-inset ring-amber-400/30 bg-amber-900/[0.06]" : ""
                                              }`}
                                            >
                                              {/* Checkbox pronta */}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); togglePreparata(fermata.id, fermata.preparata); }}
                                                disabled={isGuest}
                                                className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 ${
                                                  isGuest ? "cursor-not-allowed opacity-60" : ""
                                                } ${
                                                  fermata.preparata
                                                    ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                                    : "bg-black/20 border-gray-600 text-transparent" + (isGuest ? "" : " hover:border-gray-400")
                                                }`}
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                              {/* Negozio (5: with highlight) */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-medium text-white truncate">
                                                  <HighlightText text={fermata.descrizione} highlight={searchTerm} />
                                                </div>
                                                <div className="text-[11px] text-gray-400">{fermata.negozio ? `#${fermata.negozio}` : "Provincia"}</div>
                                              </div>
                                              {/* Pallet */}
                                              <div className="text-right shrink-0">
                                                <span className="text-[15px] font-bold text-white">{fermata.totale}</span>
                                                <span className="text-[11px] text-gray-400 ml-1">plt</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                  {/* (9) Footer totale */}
                  {groupedData.length > 0 && (
                    <tfoot className="bg-black/30 border-t border-white/10 sticky bottom-0">
                      <tr>
                        <td className="p-3" colSpan={7}>
                          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                            Totale {groupedData.length} borderò
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-[13px] font-semibold text-gray-300">
                            {groupedData.reduce((s, g) => s + g.fermate.length, 0)} fermate
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-[15px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                            {(() => { const t = groupedData.reduce((s, g) => s + g.totalePallet, 0); return t % 1 === 0 ? t : t.toFixed(1); })()}
                          </span>
                          <span className="text-[11px] text-gray-400 ml-1">plt</span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>

                {/* ── (7) Mobile card layout ── */}
                <div className="md:hidden space-y-2 p-3">
                  {loading && data.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 opacity-50" />Caricamento...
                    </div>
                  ) : groupedData.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      {data.length === 0
                        ? (isGuest ? "In attesa che l'amministratore carichi i dati del turno." : "Carica un file Excel per iniziare.")
                        : hideCompleted ? "Tutte le corse sono completate! 🎉" : "Nessun risultato con i filtri attivi."}
                    </div>
                  ) : (
                    <>
                      {groupedData.map((group) => {
                        const isExpanded = expandedBordero.has(group.bordero);
                        return (
                          <div key={group.bordero} data-bordero={group.bordero} className={`rounded-xl border overflow-hidden transition-all ${
                            group.tuttePreparate ? "border-emerald-500/20 bg-emerald-900/[0.06]" : "border-white/5 glass-card"
                          }`}>
                            {/* Card header */}
                            <button
                              onClick={() => toggleExpanded(group.bordero)}
                              className="w-full flex items-center gap-3 p-3 text-left"
                            >
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                                isExpanded ? "rotate-90" : ""
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    group.stato === "ACC" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                                    group.stato === "CHI" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                                    group.stato === "VAL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                                    group.stato === "INV" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                                    "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                                  }`}>{group.stato || "N/A"}</span>
                                  <span className="text-xs text-gray-300 font-mono truncate">{group.bordero?.replace("ID: ", "").replace("\nBORDERO:", "") || "-"}</span>
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">{group.name}</div>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                                  <span>{group.data_consegna}</span>
                                  <span>{group.ora_partenza}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-lg font-bold text-white">{group.totalePallet % 1 === 0 ? group.totalePallet : group.totalePallet.toFixed(1)}</div>
                                <div className="text-[10px] text-gray-500">pallet</div>
                                <div className={`text-[10px] font-semibold mt-0.5 ${
                                  group.tuttePreparate ? "text-emerald-400" :
                                  group.pronteCount > 0 ? "text-amber-400" : "text-gray-500"
                                }`}>
                                  {group.pronteCount}/{group.fermate.length} pronte
                                </div>
                              </div>
                            </button>
                            {/* Expanded fermate */}
                            {isExpanded && (
                              <div className="accordion-content border-t border-white/5">
                                {/* Segna tutto pronto (mobile) */}
                                {!isGuest && (
                                  <div className="px-3 py-2 border-b border-white/5 flex justify-end">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleAllPreparate(group.fermate, !group.tuttePreparate); }}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                                        group.tuttePreparate
                                          ? "bg-gray-500/15 text-gray-400 border border-gray-500/20"
                                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                      }`}
                                    >
                                      <CheckCheck className="w-3 h-3" />
                                      {group.tuttePreparate ? "Deseleziona" : "Segna tutto"}
                                    </button>
                                  </div>
                                )}
                                <div className="divide-y divide-white/[0.03]">
                                  {group.fermate.map((fermata) => {
                                    const isSearchMatch = searchTerm && (
                                      fermata.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      String(fermata.negozio).includes(searchTerm)
                                    );
                                    return (
                                      <div
                                        key={fermata.id}
                                        className={`flex items-center gap-3 px-3 py-2.5 ${
                                          fermata.preparata ? "bg-emerald-900/[0.06]" : ""
                                        } ${
                                          isSearchMatch ? "ring-1 ring-inset ring-amber-400/30 bg-amber-900/[0.06]" : ""
                                        }`}
                                      >
                                        <button
                                          onClick={(e) => { e.stopPropagation(); togglePreparata(fermata.id, fermata.preparata); }}
                                          disabled={isGuest}
                                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all shrink-0 ${
                                            isGuest ? "cursor-not-allowed opacity-60" : ""
                                          } ${
                                            fermata.preparata
                                              ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                              : "bg-black/20 border-gray-600 text-transparent"
                                          }`}
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-white truncate">
                                            <HighlightText text={fermata.descrizione} highlight={searchTerm} />
                                          </div>
                                          <div className="text-[10px] text-gray-500">{fermata.negozio ? `#${fermata.negozio}` : "Provincia"}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className="text-sm font-bold text-white">{fermata.totale}</span>
                                          <span className="text-[10px] text-gray-500 ml-1">plt</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* (9) Mobile footer totale */}
                      <div className="glass-card rounded-xl p-3 border border-white/5 flex items-center justify-between">
                        <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
                          Totale {groupedData.length} borderò · {groupedData.reduce((s, g) => s + g.fermate.length, 0)} fermate
                        </span>
                        <div>
                          <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
                            {(() => { const t = groupedData.reduce((s, g) => s + g.totalePallet, 0); return t % 1 === 0 ? t : t.toFixed(1); })()}
                          </span>
                          <span className="text-[10px] text-gray-500 ml-1">plt</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
          </div>
        </div>

        {/* ════════ COLONNA DESTRA: bottone statistiche + timeline ════════ */}
        <aside className="hidden lg:block w-[300px] shrink-0 border-l border-white/5 bg-black/20 overflow-y-auto p-4 space-y-4">

          {/* Bottone Statistiche */}
          <button
            onClick={() => setShowStatsModal(true)}
            className="w-full glass-card hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl p-4 flex items-center gap-3 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left flex-1">
              <div className="text-sm font-semibold text-white">Statistiche</div>
              <div className="text-[10px] text-gray-500">Grafici e metriche in tempo reale</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
          </button>

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-lg p-2.5 border border-white/5 text-center">
              <div className="text-lg font-bold text-white">{totPallet % 1 === 0 ? totPallet : totPallet.toFixed(1)}</div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Pallet</div>
            </div>
            <div className="glass-card rounded-lg p-2.5 border border-white/5 text-center">
              <div className="text-lg font-bold text-white">{viaggiUnici}</div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Viaggi</div>
            </div>
            <div className="glass-card rounded-lg p-2.5 border border-white/5 text-center">
              <div className={`text-lg font-bold ${prontePercent === 100 ? "text-emerald-400" : "text-white"}`}>{prontePercent}%</div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Pronte</div>
            </div>
          </div>

          {/* Progress bar mini */}
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-[width] duration-700 ease-out ${
              prontePercent === 0 ? "opacity-0" : "opacity-100"
            }`}
              style={{ width: `${prontePercent}%` }} />
          </div>

          {/* Timeline: Partenze ordinate (raggruppate per vettore) */}
          {groupedData.length > 0 && (() => {
            const timelineEntries = [...groupedData]
              .filter((g) => g.ora_partenza)
              .sort((a, b) => (a.ora_partenza || "").localeCompare(b.ora_partenza || ""));

            if (timelineEntries.length === 0) return null;

            const timeSlots = [...new Set(timelineEntries.map((g) => g.ora_partenza))];

            return (
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Timeline Partenze
                </h3>
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
                  <div className="space-y-1">
                    {timeSlots.map((time) => {
                      const entries = timelineEntries.filter((g) => g.ora_partenza === time);
                      // Group entries by carrier name within this time slot
                      const carrierGroups = new Map<string, GroupedBordero[]>();
                      entries.forEach((entry) => {
                        const key = entry.name || "N/A";
                        if (!carrierGroups.has(key)) carrierGroups.set(key, []);
                        carrierGroups.get(key)!.push(entry);
                      });

                      return (
                        <div key={time} className="relative">
                          <div className="flex items-center gap-2.5 py-1.5">
                            <div className="w-[15px] h-[15px] rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center z-10 shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            </div>
                            <span className="text-[11px] font-bold text-white font-mono">{time}</span>
                          </div>
                          <div className="ml-[22px] space-y-1 pb-1">
                            {Array.from(carrierGroups).map(([carrierName, carrierEntries]) => {
                              const totalFermate = carrierEntries.reduce((s, e) => s + e.fermate.length, 0);
                              const totalPronte = carrierEntries.reduce((s, e) => s + e.pronteCount, 0);
                              const totalPlt = carrierEntries.reduce((s, e) => s + e.totalePallet, 0);
                              const allDone = totalPronte === totalFermate && totalFermate > 0;
                              const pct = totalFermate > 0 ? Math.round((totalPronte / totalFermate) * 100) : 0;
                              const count = carrierEntries.length;

                              const carrierBorderoIds = carrierEntries.map((e) => e.bordero);
                              const isActiveFilter = timelineFilterBorderos !== null &&
                                carrierBorderoIds.every((b) => timelineFilterBorderos.has(b)) &&
                                timelineFilterBorderos.size === carrierBorderoIds.length;

                              return (
                                <div key={carrierName}
                                  onClick={() => toggleTimelineFilter(carrierBorderoIds)}
                                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                                  isActiveFilter
                                    ? "bg-blue-500/15 border border-blue-400/40 ring-1 ring-blue-400/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                                    : allDone ? "bg-emerald-900/15 border border-emerald-500/15 hover:ring-1 hover:ring-blue-400/30"
                                    : "bg-white/[0.03] border border-white/5 hover:ring-1 hover:ring-blue-400/30"
                                }`}>
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    isActiveFilter ? "bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.6)]" :
                                    allDone ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" :
                                    totalPronte > 0 ? "bg-amber-400" : "bg-gray-500"
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-[11px] font-medium truncate ${
                                      isActiveFilter ? "text-blue-200" : "text-gray-200"
                                    }`}>
                                      {carrierName}
                                      {count > 1 && (
                                        <span className="ml-1 text-[9px] text-gray-500 font-normal">×{count}</span>
                                      )}
                                    </div>
                                    <div className="text-[9px] text-gray-500 truncate">
                                      {totalFermate} fermate · {totalPlt % 1 === 0 ? totalPlt : totalPlt.toFixed(1)} plt
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${
                                        allDone ? "bg-emerald-400" :
                                        totalPronte > 0 ? "bg-amber-400" : ""
                                      }`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[9px] text-gray-500 w-7 text-right">{pct}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </aside>
      </div>

      {/* ── STATISTICHE MODAL ── */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowStatsModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Statistiche</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Dashboard dati filtrati in tempo reale</p>
                </div>
              </div>
              <button onClick={() => setShowStatsModal(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stat cards row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Pallet Totali" value={totPallet % 1 === 0 ? String(totPallet) : totPallet.toFixed(1)} color="bg-blue-500" />
                <StatCard label="Viaggi Unici" value={String(viaggiUnici)} color="bg-purple-500" />
                <StatCard label="Righe Filtrate" value={String(filteredData.length)} color="bg-cyan-500" />
                <StatCard label="Pronte" value={`${prontePercent}%`} sub={`${pronteCount}/${filteredData.length}`} color="bg-emerald-500" />
              </div>

              {/* Avanzamento */}
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Avanzamento Preparazione
                  </h3>
                  <span className="text-xs text-emerald-400 font-bold">{prontePercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-[width] duration-700 ease-out ${
                    prontePercent === 0 ? "opacity-0" : "opacity-100"
                  }`}
                    style={{ width: `${prontePercent}%` }} />
                </div>
              </div>

              {filteredData.length > 0 && (
                <>
                  {/* Charts grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bar: Pallet per Vettore */}
                    <div className="glass-card p-4 rounded-xl border border-white/5">
                      <h3 className="text-xs font-semibold text-gray-300 mb-3">📦 Pallet per Vettore</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartPalletPerVettore} layout="vertical" margin={{ left: -10, right: 5 }}>
                          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fill: "#d1d5db", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff", fontSize: 12 }} itemStyle={{ color: "#3b82f6" }} />
                          <Bar dataKey="pallet" radius={[0, 4, 4, 0]} fill="url(#barGradientModal)" />
                          <defs>
                            <linearGradient id="barGradientModal" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Bar: Pallet per Data Consegna */}
                    <div className="glass-card p-4 rounded-xl border border-white/5">
                      <h3 className="text-xs font-semibold text-gray-300 mb-3">📅 Pallet per Data Consegna</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartPalletPerData} margin={{ left: -10, right: 5 }}>
                          <XAxis dataKey="data" tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff", fontSize: 12 }} itemStyle={{ color: "#8b5cf6" }} />
                          <Bar dataKey="pallet" radius={[4, 4, 0, 0]} fill="url(#barGradient2Modal)" />
                          <defs>
                            <linearGradient id="barGradient2Modal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#6366f1" />
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie charts row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pie: Distribuzione Stato */}
                    <div className="glass-card p-4 rounded-xl border border-white/5">
                      <h3 className="text-xs font-semibold text-gray-300 mb-3">🔖 Distribuzione Stato</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={chartStatoPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                            {chartStatoPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#d1d5db" }} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Pie: Preparazione */}
                    <div className="glass-card p-4 rounded-xl border border-white/5">
                      <h3 className="text-xs font-semibold text-gray-300 mb-3">✅ Preparazione</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={chartPreparataPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                            <Cell fill="#10b981" />
                            <Cell fill="#374151" />
                          </Pie>
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#d1d5db" }} />
                          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONFIRM RESET MODAL ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass p-6 rounded-2xl border border-white/15 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Cancella Tabella</h3>
                <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Azione Irreversibile</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-300 leading-relaxed">
              Questa azione eliminerà permanentemente tutti i record correnti dal database. I dati del turno non potranno essere recuperati.
            </p>
            
            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                Per confermare, digita <span className="text-red-400 font-bold font-mono">cancella</span>:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="cancella"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-mono"
              />
            </div>
            
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirmText(""); }}
                className="px-4 py-2 rounded-lg border border-white/10 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={executeReset}
                disabled={resetConfirmText !== "cancella"}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-950 disabled:text-gray-500 text-white font-medium px-4 py-2 rounded-lg transition-all text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
              >
                Conferma Cancellazione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

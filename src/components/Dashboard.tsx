"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import {
  Upload, FileSpreadsheet, Search, Filter, RefreshCw,
  Download, Trash2, Check, ChevronDown, ChevronRight, X, TrendingUp, Package, LogOut,
  Layers, List, MapPin
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

const CHART_COLORS = [
  "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#f97316",
];

/* ─── DropdownFilter ─── */
function DropdownFilter({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1 font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-white/10 transition-colors"
        >
          <option value="" className="bg-[#1e2128]">Tutti</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-[#1e2128]">{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
      </div>
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

  const [filterNegozio, setFilterNegozio] = useState("");
  const [filterVettore, setFilterVettore] = useState("");
  const [filterDataCarico, setFilterDataCarico] = useState("");
  const [filterDataConsegna, setFilterDataConsegna] = useState("");
  const [filterStato, setFilterStato] = useState("");
  const [onlineAdmins, setOnlineAdmins] = useState(0);
  const [onlineGuests, setOnlineGuests] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");
  const [expandedBordero, setExpandedBordero] = useState<Set<string>>(new Set());

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
      const matchNegozio = !filterNegozio || `${item.negozio} – ${item.descrizione}` === filterNegozio;
      const matchVettore = !filterVettore || item.name === filterVettore;
      const matchDataCarico = !filterDataCarico || item.data_arrivo_carico === filterDataCarico;
      const matchDataConsegna = !filterDataConsegna || item.data_consegna === filterDataConsegna;
      const matchStato = !filterStato || item.stato === filterStato;
      return matchSearch && matchNegozio && matchVettore && matchDataCarico && matchDataConsegna && matchStato;
    });
  }, [data, searchTerm, filterNegozio, filterVettore, filterDataCarico, filterDataConsegna, filterStato]);

  const activeFilterCount = [filterNegozio, filterVettore, filterDataCarico, filterDataConsegna, filterStato].filter(Boolean).length;
  const clearAllFilters = () => { setSearchTerm(""); setFilterNegozio(""); setFilterVettore(""); setFilterDataCarico(""); setFilterDataConsegna(""); setFilterStato(""); };

  /* ─── Grouped data ─── */
  const groupedData = useMemo(() => {
    const map = new Map<string, Consegna[]>();
    filteredData.forEach((row) => {
      const key = row.bordero || "__no_bordero__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    const groups: GroupedBordero[] = [];
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
    return groups;
  }, [filteredData]);

  const toggleExpanded = (bordero: string) => {
    setExpandedBordero((prev) => {
      const next = new Set(prev);
      if (next.has(bordero)) next.delete(bordero);
      else next.add(bordero);
      return next;
    });
  };

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
              <DropdownFilter label="Negozio" options={uniqueNegozi} value={filterNegozio} onChange={setFilterNegozio} />
              <DropdownFilter label="Vettore" options={uniqueVettori} value={filterVettore} onChange={setFilterVettore} />
              <DropdownFilter label="Data Carico" options={uniqueDataCarico} value={filterDataCarico} onChange={setFilterDataCarico} />
              <DropdownFilter label="Data Consegna" options={uniqueDataConsegna} value={filterDataConsegna} onChange={setFilterDataConsegna} />
              <DropdownFilter label="Stato" options={uniqueStati} value={filterStato} onChange={setFilterStato} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <Filter className="w-3 h-3" />
                {viewMode === "grouped"
                  ? <>{groupedData.length} borderò ({filteredData.length} fermate totali)</>
                  : <>{filteredData.length} di {data.length} righe</>}
              </div>
              <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 p-0.5">
                <button
                  onClick={() => setViewMode("flat")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    viewMode === "flat"
                      ? "bg-blue-500/20 text-blue-300 shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <List className="w-3 h-3" /> Tutte le righe
                </button>
                <button
                  onClick={() => setViewMode("grouped")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    viewMode === "grouped"
                      ? "bg-blue-500/20 text-blue-300 shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Layers className="w-3 h-3" /> Per Borderò
                </button>
              </div>
            </div>
          </div>

          {/* Tabella scrollabile */}
          <div className="flex-1 overflow-auto">
            {viewMode === "flat" ? (
              /* ═══ VISTA PIATTA (originale) ═══ */
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-black/40 text-gray-300 uppercase font-semibold text-[11px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-14 text-center">Pronta</th>
                    <th className="p-3">Stato</th>
                    <th className="p-3">Borderò</th>
                    <th className="p-3">Negozio</th>
                    <th className="p-3">Vettore</th>
                    <th className="p-3">Data Carico</th>
                    <th className="p-3">Data Cons.</th>
                    <th className="p-3">Ora Part.</th>
                    <th className="p-3 text-right">Pallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && data.length === 0 ? (
                    <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 opacity-50" />Caricamento...
                    </td></tr>
                  ) : filteredData.length === 0 ? (
                    <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      {data.length === 0 
                        ? (isGuest ? "In attesa che l'amministratore carichi i dati del turno." : "Carica un file Excel per iniziare.") 
                        : "Nessun risultato con i filtri attivi."}
                    </td></tr>
                  ) : (
                    filteredData.map((row) => (
                      <tr key={row.id} className={`hover:bg-white/5 transition-colors ${row.preparata ? "bg-emerald-900/10" : ""}`}>
                        <td className="p-3 text-center">
                          <button onClick={() => togglePreparata(row.id, row.preparata)}
                            disabled={isGuest}
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                              isGuest ? "cursor-not-allowed opacity-60" : ""
                            } ${
                              row.preparata
                                ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                : "bg-black/20 border-gray-600 text-transparent" + (isGuest ? "" : " hover:border-gray-400")
                            }`}>
                            <Check className="w-3 h-3" />
                          </button>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.stato === "ACC" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                            row.stato === "CHI" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                            row.stato === "VAL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                            "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                          }`}>{row.stato || "N/A"}</span>
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-300">{row.bordero?.replace("ID: ", "").replace("\nBORDERO:", "") || "-"}</td>
                        <td className="p-3">
                          <div className="font-medium text-white text-xs">{row.descrizione}</div>
                          <div className="text-[10px] text-gray-500">#{row.negozio}</div>
                        </td>
                        <td className="p-3 text-gray-300 text-xs">{row.name}</td>
                        <td className="p-3 text-gray-400 text-xs">{row.data_arrivo_carico}</td>
                        <td className="p-3 text-gray-400 text-xs">{row.data_consegna}</td>
                        <td className="p-3 text-gray-400 text-xs">{row.ora_partenza}</td>
                        <td className="p-3 text-right font-bold text-white">{row.totale}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* ═══ VISTA RAGGRUPPATA PER BORDERÒ ═══ */
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-black/40 text-gray-300 uppercase font-semibold text-[11px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-10"></th>
                    <th className="p-3">Stato</th>
                    <th className="p-3">Borderò</th>
                    <th className="p-3">Vettore</th>
                    <th className="p-3">Data Carico</th>
                    <th className="p-3">Data Cons.</th>
                    <th className="p-3">Ora Part.</th>
                    <th className="p-3 text-center">Fermate</th>
                    <th className="p-3 text-right">Pallet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading && data.length === 0 ? (
                    <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 opacity-50" />Caricamento...
                    </td></tr>
                  ) : groupedData.length === 0 ? (
                    <tr><td colSpan={9} className="p-12 text-center text-gray-400">
                      <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      {data.length === 0
                        ? (isGuest ? "In attesa che l'amministratore carichi i dati del turno." : "Carica un file Excel per iniziare.")
                        : "Nessun risultato con i filtri attivi."}
                    </td></tr>
                  ) : (
                    groupedData.map((group) => {
                      const isExpanded = expandedBordero.has(group.bordero);
                      return (
                        <Fragment key={group.bordero}>
                          {/* ── Riga raggruppata ── */}
                          <tr
                            onClick={() => toggleExpanded(group.bordero)}
                            className={`cursor-pointer transition-colors select-none ${
                              group.tuttePreparate ? "bg-emerald-900/10" : ""
                            } ${
                              isExpanded ? "bg-white/[0.03]" : "hover:bg-white/5"
                            }`}
                          >
                            <td className="p-3 text-center">
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`} />
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                group.stato === "ACC" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                                group.stato === "CHI" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                                group.stato === "VAL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                                "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                              }`}>{group.stato || "N/A"}</span>
                            </td>
                            <td className="p-3 font-mono text-xs text-gray-300">{group.bordero?.replace("ID: ", "").replace("\nBORDERO:", "") || "-"}</td>
                            <td className="p-3 text-gray-300 text-xs">{group.name}</td>
                            <td className="p-3 text-gray-400 text-xs">{group.data_arrivo_carico}</td>
                            <td className="p-3 text-gray-400 text-xs">{group.data_consegna}</td>
                            <td className="p-3 text-gray-400 text-xs">{group.ora_partenza}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <MapPin className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-300">{group.fermate.length}</span>
                                <span className="text-[10px] text-gray-500">•</span>
                                <span className={`text-[10px] font-semibold ${
                                  group.tuttePreparate ? "text-emerald-400" :
                                  group.pronteCount > 0 ? "text-amber-400" : "text-gray-500"
                                }`}>
                                  {group.pronteCount}/{group.fermate.length}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold text-white">{group.totalePallet % 1 === 0 ? group.totalePallet : group.totalePallet.toFixed(1)}</td>
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
                                        <span className="text-xs font-semibold text-gray-200">
                                          {group.fermate.length} {group.fermate.length === 1 ? "fermata" : "fermate"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {/* Mini progress bar */}
                                        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                                            style={{ width: `${group.fermate.length > 0 ? (group.pronteCount / group.fermate.length) * 100 : 0}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-400">
                                          {group.pronteCount}/{group.fermate.length} pronte
                                        </span>
                                      </div>
                                    </div>
                                    {/* Fermate list */}
                                    <div className="divide-y divide-white/[0.03]">
                                      {group.fermate.map((fermata) => (
                                        <div
                                          key={fermata.id}
                                          className={`flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
                                            fermata.preparata ? "bg-emerald-900/[0.06]" : ""
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
                                          {/* Negozio */}
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white truncate">{fermata.descrizione}</div>
                                            <div className="text-[10px] text-gray-500">#{fermata.negozio}</div>
                                          </div>
                                          {/* Pallet */}
                                          <div className="text-right shrink-0">
                                            <span className="text-sm font-bold text-white">{fermata.totale}</span>
                                            <span className="text-[10px] text-gray-500 ml-1">plt</span>
                                          </div>
                                        </div>
                                      ))}
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
              </table>
            )}
          </div>
        </div>

        {/* ════════ COLONNA DESTRA: statistiche + grafici ════════ */}
        <aside className="hidden lg:block w-[340px] shrink-0 border-l border-white/5 bg-black/20 overflow-y-auto p-4 space-y-4">

          {/* Stat cards 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pallet" value={totPallet.toFixed(1)} color="bg-blue-500" />
            <StatCard label="Viaggi" value={String(viaggiUnici)} color="bg-purple-500" />
            <StatCard label="Righe" value={String(filteredData.length)} color="bg-cyan-500" />
            <StatCard label="Pronte" value={`${prontePercent}%`} sub={`${pronteCount}/${filteredData.length}`} color="bg-emerald-500" />
          </div>

          {/* Avanzamento barra */}
          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Avanzamento
              </h3>
              <span className="text-xs text-emerald-400 font-bold">{prontePercent}%</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${prontePercent}%` }} />
            </div>
          </div>

          {/* Chart: Pallet per Vettore */}
          {filteredData.length > 0 && (
            <>
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-semibold text-gray-300 mb-3">📦 Pallet per Vettore</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartPalletPerVettore} layout="vertical" margin={{ left: -10, right: 5 }}>
                    <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: "#d1d5db", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff", fontSize: 12 }} itemStyle={{ color: "#3b82f6" }} />
                    <Bar dataKey="pallet" radius={[0, 4, 4, 0]} fill="url(#barGradient)" />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie: Stato */}
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-semibold text-gray-300 mb-3">🔖 Distribuzione Stato</h3>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={chartStatoPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
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
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={chartPreparataPie} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value" stroke="none">
                      <Cell fill="#10b981" />
                      <Cell fill="#374151" />
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#d1d5db" }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar: Pallet per Data Consegna */}
              <div className="glass-card p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-semibold text-gray-300 mb-3">📅 Pallet per Data Consegna</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartPalletPerData} margin={{ left: -10, right: 5 }}>
                    <XAxis dataKey="data" tick={{ fill: "#9ca3af", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff", fontSize: 12 }} itemStyle={{ color: "#8b5cf6" }} />
                    <Bar dataKey="pallet" radius={[4, 4, 0, 0]} fill="url(#barGradient2)" />
                    <defs>
                      <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </aside>
      </div>

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

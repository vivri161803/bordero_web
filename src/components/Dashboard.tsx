"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Upload, FileSpreadsheet, Search, Filter, RefreshCw,
  Download, Trash2, Check, ChevronDown, X, TrendingUp, Package
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
export default function Dashboard() {
  const [data, setData] = useState<Consegna[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterNegozio, setFilterNegozio] = useState("");
  const [filterVettore, setFilterVettore] = useState("");
  const [filterDataCarico, setFilterDataCarico] = useState("");
  const [filterDataConsegna, setFilterDataConsegna] = useState("");

  /* ─── Supabase ─── */
  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel("consegne_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "consegne" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
      return matchSearch && matchNegozio && matchVettore && matchDataCarico && matchDataConsegna;
    });
  }, [data, searchTerm, filterNegozio, filterVettore, filterDataCarico, filterDataConsegna]);

  const activeFilterCount = [filterNegozio, filterVettore, filterDataCarico, filterDataConsegna].filter(Boolean).length;
  const clearAllFilters = () => { setSearchTerm(""); setFilterNegozio(""); setFilterVettore(""); setFilterDataCarico(""); setFilterDataConsegna(""); };

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
    setData(data.map((i) => (i.id === id ? { ...i, preparata: !cur } : i)));
    const { error } = await supabase.from("consegne").update({ preparata: !cur }).eq("id", id);
    if (error) fetchData();
  };

  const handleFineTurno = async () => {
    if (confirm("Sei sicuro di voler svuotare il database e iniziare un nuovo turno?")) {
      setLoading(true);
      try { await fetch("/api/reset", { method: "POST" }); await fetchData(); }
      catch { alert("Errore durante il reset."); setLoading(false); }
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
      <header className="shrink-0 glass border-b border-white/5 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              Dashboard Consegne
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xls,.xlsx" onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            className="glass hover:bg-white/10 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all">
            {isUploading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {isUploading ? "Elaborazione..." : "Carica Excel"}
          </button>
          <button onClick={downloadCSV}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all shadow-[0_0_12px_rgba(37,99,235,0.3)]">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={handleFineTurno}
            className="bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/40 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all">
            <Trash2 className="w-4 h-4" /> Fine Turno
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
            <div className="grid grid-cols-4 gap-3">
              <DropdownFilter label="Negozio" options={uniqueNegozi} value={filterNegozio} onChange={setFilterNegozio} />
              <DropdownFilter label="Vettore" options={uniqueVettori} value={filterVettore} onChange={setFilterVettore} />
              <DropdownFilter label="Data Carico" options={uniqueDataCarico} value={filterDataCarico} onChange={setFilterDataCarico} />
              <DropdownFilter label="Data Consegna" options={uniqueDataConsegna} value={filterDataConsegna} onChange={setFilterDataConsegna} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <Filter className="w-3 h-3" />
              {filteredData.length} di {data.length} righe
            </div>
          </div>

          {/* Tabella scrollabile */}
          <div className="flex-1 overflow-auto">
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
                    {data.length === 0 ? "Carica un file Excel per iniziare." : "Nessun risultato con i filtri attivi."}
                  </td></tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.id} className={`hover:bg-white/5 transition-colors ${row.preparata ? "bg-emerald-900/10" : ""}`}>
                      <td className="p-3 text-center">
                        <button onClick={() => togglePreparata(row.id, row.preparata)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            row.preparata
                              ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                              : "bg-black/20 border-gray-600 text-transparent hover:border-gray-400"
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
          </div>
        </div>

        {/* ════════ COLONNA DESTRA: statistiche + grafici ════════ */}
        <aside className="w-[340px] shrink-0 border-l border-white/5 bg-black/20 overflow-y-auto p-4 space-y-4">

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
    </div>
  );
}

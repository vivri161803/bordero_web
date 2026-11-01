"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { STATO_INFO, compareItDates, formatPallet, shortDate, type Consegna } from "@/lib/consegne";
import { Modal } from "./ui";

const tooltipStyle = { background: "#1e2124", border: "1px solid #3b4046", borderRadius: 8, fontFamily: "var(--font-plex-mono)" };
const axisTick = { fill: "#9599a0", fontSize: 12 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-bg p-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wider text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function HBar({ label, value, max, sub, tone = "ink" }: { label: string; value: number; max: number; sub?: string; tone?: "ink" | "ok" }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-ink-2">{label}</span>
        <span className="font-mono text-ink tnum">{sub ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-panel-3">
        <div className={tone === "ok" ? "h-full rounded-full bg-ok" : "h-full rounded-full bg-ink-2"}
          style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

export default function StatsModal({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: Consegna[] }) {
  const perVettore = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((d) => map.set(d.name || "N/D", (map.get(d.name || "N/D") || 0) + (Number(d.totale) || 0)));
    return [...map].map(([name, pallet]) => ({ name, pallet: +pallet.toFixed(1) })).sort((a, b) => b.pallet - a.pallet).slice(0, 12);
  }, [rows]);

  const perData = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((d) => map.set(d.data_consegna || "N/D", (map.get(d.data_consegna || "N/D") || 0) + (Number(d.totale) || 0)));
    return [...map].sort((a, b) => compareItDates(a[0], b[0])).map(([data, pallet]) => ({ data: shortDate(data), pallet: +pallet.toFixed(1) }));
  }, [rows]);

  const perStato = useMemo(() => {
    const map = new Map<string, { tot: number; pronte: number }>();
    rows.forEach((d) => {
      const k = d.stato || "N/D";
      const cur = map.get(k) || { tot: 0, pronte: 0 };
      cur.tot += 1;
      if (d.preparata) cur.pronte += 1;
      map.set(k, cur);
    });
    return [...map].sort((a, b) => b[1].tot - a[1].tot);
  }, [rows]);

  const pronte = rows.filter((r) => r.preparata).length;

  return (
    <Modal open={open} onClose={onClose} title="Statistiche" subtitle="Calcolate sui dati filtrati"
      icon={<BarChart3 className="h-5 w-5" />} size="lg">
      {rows.length === 0 ? (
        <p className="p-8 text-center text-ink-3">Nessun dato con i filtri attuali.</p>
      ) : (
        <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
          <Section title="Preparazione">
            <HBar label="Fermate pronte" value={pronte} max={rows.length} sub={`${pronte}/${rows.length}`} tone="ok" />
            <div className="mt-4 space-y-3">
              {perStato.map(([stato, v]) => (
                <HBar key={stato} label={`${stato}${STATO_INFO[stato] ? ` · ${STATO_INFO[stato]}` : ""}`}
                  value={v.pronte} max={v.tot} sub={`${v.pronte}/${v.tot}`} tone={v.pronte === v.tot ? "ok" : "ink"} />
              ))}
            </div>
          </Section>

          <Section title="Pallet per data di consegna">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={perData} margin={{ left: -16, right: 4, top: 4 }}>
                <XAxis dataKey="data" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#ecebe8" }} itemStyle={{ color: "#f2d31b" }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [formatPallet(Number(v)), "Pallet"]} />
                <Bar dataKey="pallet" radius={[4, 4, 0, 0]} fill="#f2d31b" />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <div className="md:col-span-2">
            <Section title="Pallet per vettore (primi 12)">
              <ResponsiveContainer width="100%" height={Math.max(160, perVettore.length * 30)}>
                <BarChart data={perVettore} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ ...axisTick, fill: "#c2c5c9" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#ecebe8" }} itemStyle={{ color: "#ecebe8" }}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [formatPallet(Number(v)), "Pallet"]} />
                  <Bar dataKey="pallet" radius={[0, 4, 4, 0]} fill="#c2c5c9" />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>
        </div>
      )}
    </Modal>
  );
}

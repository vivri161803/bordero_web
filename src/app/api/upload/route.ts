import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { getUserClient } from "@/lib/supabase-server";

type Riga = {
  preparata: boolean;
  bordero: string;
  stato: string;
  data_arrivo_carico: string;
  ora_partenza: string;
  negozio: number;
  descrizione: string;
  data_consegna: string;
  name: string;
  data_preparazione: null;
  controllo: string;
  totale: number;
  provincia: string | null;
  note_consegna: string | null;
};

type Cell = string | number | boolean | null;

function text(v: Cell | undefined): string {
  return v == null ? "" : String(v).trim();
}

function parseWorkbook(buffer: ArrayBuffer): Riga[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const righe: Riga[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: Cell[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!data || data.length < 5) continue;

    let vettore = data[2] && data[2][5] ? text(data[2][5]) : "";

    let data_consegna = "";
    const initialConsegnaRaw = data[2] && data[2][11] ? String(data[2][11]) : "";
    if (initialConsegnaRaw.includes("DATA CONSEGNA")) {
      data_consegna = initialConsegnaRaw.replace("DATA CONSEGNA:", "").trim();
    }

    let currentBordero = "";
    let currentStato = "";
    let currentDataArrivo = "";

    for (let i = 5; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      // Nuova intestazione di sotto-tabella all'interno dello stesso foglio
      const vettoreCell = text(row[3]);
      if (vettoreCell.startsWith("VETTORE:")) {
        if (row[5]) vettore = text(row[5]);
        const consegnaRaw = row[11] ? String(row[11]) : "";
        if (consegnaRaw.includes("DATA CONSEGNA")) {
          data_consegna = consegnaRaw.replace("DATA CONSEGNA:", "").trim();
        }
        continue;
      }

      for (let c = 8; c < (row.length || 0); c++) {
        if (row[c]) {
          const cellStr = String(row[c]);
          if (cellStr.includes("DATA CONSEGNA")) {
            data_consegna = cellStr.replace("DATA CONSEGNA:", "").trim();
            break;
          }
        }
      }

      const dataBorderoCell = row[1];
      if (typeof dataBorderoCell === "string" && dataBorderoCell.startsWith("ID:")) {
        currentBordero = dataBorderoCell;
        currentStato = text(row[3]);
        currentDataArrivo = i + 2 < data.length && data[i + 2] && data[i + 2][1] ? String(data[i + 2][1]) : "";
      }

      const codPdv = parseInt(String(row[4]), 10);
      const plt = parseFloat(String(row[7]));
      const provincia = text(row[6]) || null;
      const note = text(row[10]) || null;

      if (!isNaN(codPdv) && !isNaN(plt)) {
        righe.push({
          preparata: false,
          bordero: currentBordero,
          stato: currentStato,
          data_arrivo_carico: currentDataArrivo,
          ora_partenza: text(row[2]),
          negozio: codPdv,
          descrizione: text(row[5]),
          data_consegna,
          name: vettore,
          data_preparazione: null,
          controllo: "ok",
          totale: plt,
          provincia,
          note_consegna: note,
        });
      } else if (currentStato === "INV" && isNaN(codPdv) && !isNaN(plt)) {
        // Corse INV: nessun negozio, solo provincia e pallet. Una riga per provincia con negozio = 0.
        righe.push({
          preparata: false,
          bordero: currentBordero,
          stato: currentStato,
          data_arrivo_carico: currentDataArrivo,
          ora_partenza: text(row[2]),
          negozio: 0,
          descrizione: provincia || "N/D",
          data_consegna,
          name: vettore,
          data_preparazione: null,
          controllo: "ok",
          totale: plt,
          provincia,
          note_consegna: note,
        });
      }
    }
  }
  return righe;
}

const fermataKey = (r: { bordero: string; negozio: number; descrizione: string }) =>
  `${r.bordero}|${r.negozio}|${r.descrizione}`;

/**
 * Inserisce le righe. Se il database non ha ancora le colonne `provincia` / `note_consegna`
 * (migrazione non applicata), riprova senza.
 */
async function insertRighe(supabase: SupabaseClient, righe: Riga[]) {
  if (righe.length === 0) return null;
  const { error } = await supabase.from("consegne").insert(righe);
  if (!error) return null;
  if (/provincia|note_consegna/.test(error.message)) {
    const ridotte = righe.map((r) => {
      const { provincia: _p, note_consegna: _n, ...rest } = r;
      void _p; void _n;
      return rest;
    });
    const retry = await supabase.from("consegne").insert(ridotte);
    return retry.error;
  }
  return error;
}

/**
 * POST /api/upload
 * form-data: file, mode? = "check" (default) | "replace" | "skip"
 * - check:   se nel database ci sono già borderò del file risponde 409 senza scrivere nulla
 * - replace: sostituisce i borderò già presenti mantenendo lo stato "pronta" delle fermate uguali
 * - skip:    aggiunge solo i borderò nuovi
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserClient(req);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = String(formData.get("mode") || "check");
    if (!file) {
      return NextResponse.json({ error: "Nessun file fornito" }, { status: 400 });
    }

    const righe = parseWorkbook(await file.arrayBuffer());
    if (righe.length === 0) {
      return NextResponse.json({ error: "Nessun dato valido trovato nel file." }, { status: 400 });
    }

    const borderoNelFile = [...new Set(righe.map((r) => r.bordero))];

    const { data: esistenti, error: selectError } = await supabase
      .from("consegne")
      .select("bordero, negozio, descrizione, preparata")
      .in("bordero", borderoNelFile);
    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    const borderoEsistenti = new Set((esistenti || []).map((r) => r.bordero as string));
    const totaleBordero = borderoNelFile.length;

    if (borderoEsistenti.size > 0 && mode === "check") {
      return NextResponse.json(
        {
          conflict: true,
          existing: borderoEsistenti.size,
          total: totaleBordero,
          message: `${borderoEsistenti.size} borderò su ${totaleBordero} sono già presenti.`,
        },
        { status: 409 },
      );
    }

    let daInserire = righe;
    let replaced = 0;
    let skipped = 0;

    if (borderoEsistenti.size > 0 && mode === "skip") {
      daInserire = righe.filter((r) => !borderoEsistenti.has(r.bordero));
      skipped = borderoEsistenti.size;
    } else if (borderoEsistenti.size > 0 && mode === "replace") {
      const pronte = new Set(
        (esistenti || []).filter((r) => r.preparata).map((r) => fermataKey(r as Riga)),
      );
      daInserire = righe.map((r) => (pronte.has(fermataKey(r)) ? { ...r, preparata: true } : r));
      const { error: deleteError } = await supabase
        .from("consegne")
        .delete()
        .in("bordero", [...borderoEsistenti]);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      replaced = borderoEsistenti.size;
    }

    const insertError = await insertRighe(supabase, daInserire);
    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Success",
      count: daInserire.length,
      bordero: totaleBordero - skipped,
      replaced,
      skipped,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    const message = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

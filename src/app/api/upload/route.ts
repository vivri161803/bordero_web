import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    throw new Error("Credenziali Supabase mancanti.");
  }
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Nessun file fornito" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const df_finali = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      
      if (!data || data.length < 5) continue;

      let vettore = "";
      if (data[2] && data[2][5]) vettore = String(data[2][5]).trim();

      let data_consegna = null;
      let data_consegna_raw = data[2] && data[2][11] ? String(data[2][11]) : "";
      if (data_consegna_raw.includes("DATA CONSEGNA")) {
        data_consegna = data_consegna_raw.replace("DATA CONSEGNA:", "").trim();
      }

      let currentBordero: string | null = null;
      let currentStato: string | null = null;
      let currentDataArrivo: string | null = null;

      for (let i = 5; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        
        const dataBorderoCell = row[1];
        const canCell = row[3];
        
        if (typeof dataBorderoCell === "string" && dataBorderoCell.startsWith("ID:")) {
          currentBordero = dataBorderoCell;
          currentStato = canCell ? String(canCell) : null;
          
          if (i + 2 < data.length && data[i + 2] && data[i + 2][1]) {
             currentDataArrivo = String(data[i + 2][1]);
          } else {
             currentDataArrivo = null;
          }
        }
        
        const codPdvCell = row[4];
        const pltCell = row[7];
        
        const codPdv = parseInt(String(codPdvCell), 10);
        const plt = parseFloat(String(pltCell));
        
        if (!isNaN(codPdv) && !isNaN(plt)) {
          df_finali.push({
            preparata: false,
            bordero: currentBordero || "",
            stato: currentStato || "",
            data_arrivo_carico: currentDataArrivo || "",
            ora_partenza: row[2] ? String(row[2]) : "",
            negozio: codPdv,
            descrizione: row[5] ? String(row[5]) : "",
            data_consegna: data_consegna || "",
            name: vettore,
            data_preparazione: null,
            controllo: "ok",
            totale: plt
          });
        }
      }
    }

    if (df_finali.length === 0) {
      return NextResponse.json({ error: "Nessun dato valido trovato nel file." }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("consegne").insert(df_finali);
    
    if (error) {
       console.error("Supabase insert error:", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Success", count: df_finali.length });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

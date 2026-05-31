import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("consegne").delete().neq("id", 0);
    
    if (error) {
       console.error("Supabase reset error:", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Tabella svuotata con successo. Fine turno completato." });
  } catch (err: any) {
    console.error("Reset handler error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

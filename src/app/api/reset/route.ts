import { NextRequest, NextResponse } from "next/server";
import { getUserClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserClient(req);
    if (auth.error) return auth.error;

    const { error } = await auth.supabase.from("consegne").delete().neq("id", 0);

    if (error) {
       console.error("Supabase reset error:", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Tabella svuotata con successo. Fine turno completato." });
  } catch (err) {
    console.error("Reset handler error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore sconosciuto" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase che agisce come l'utente che ha fatto la richiesta (token "Bearer" nell'header),
 * così le regole RLS del database si applicano anche alle API.
 * Restituisce una risposta 401 se manca un utente con login valido.
 */
export async function getUserClient(
  req: Request,
): Promise<{ supabase: SupabaseClient; error?: undefined } | { supabase?: undefined; error: NextResponse }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    return { error: NextResponse.json({ error: "Credenziali Supabase mancanti." }, { status: 500 }) };
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const unauthorized = { error: NextResponse.json({ error: "Accesso non autorizzato: effettua il login." }, { status: 401 }) };
  if (!token) return unauthorized;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return unauthorized;

  return { supabase };
}

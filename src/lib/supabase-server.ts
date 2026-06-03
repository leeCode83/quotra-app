import { supabaseAdmin } from "./supabase-admin";

export async function createClient() {
  // Demo hack: Always return the supabaseAdmin client
  // This completely bypasses RLS for any server-side interaction.
  return supabaseAdmin;
}

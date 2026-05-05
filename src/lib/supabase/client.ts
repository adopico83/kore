import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { KoreDatabase } from "@/lib/kore-db";

let browserClient: SupabaseClient<KoreDatabase> | null = null;

export function getBrowserClient(): SupabaseClient<KoreDatabase> {
  if (browserClient) return browserClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno");
  if (!supabaseAnonKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno");
  browserClient = createBrowserClient<KoreDatabase>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

import { getScopedIdentity } from "@/lib/family-context";
import type { KoreServerDbClient } from "@/lib/kore-db";
import { createClient } from "@/lib/supabase/server";

/**
 * Única puerta de datos con sesión: familia validada y cliente con cookies,
 * para que RLS aplique. Sin familia no hay cliente.
 * La identidad sale de getScopedIdentity (un getUser y un profile por request).
 */
export async function requireFamilyDb(): Promise<{ familyId: string; client: KoreServerDbClient }> {
  const { familyId } = await getScopedIdentity();
  if (!familyId) throw new Error("No family context");
  const client = await createClient();
  return { familyId, client };
}

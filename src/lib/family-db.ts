import { getScopedFamilyId } from "@/lib/family-context";
import type { KoreServerDbClient } from "@/lib/kore-db";
import { createClient } from "@/lib/supabase/server";

/**
 * Única puerta de datos con sesión: familia validada y cliente con cookies,
 * para que RLS aplique. Sin familia no hay cliente.
 */
export async function requireFamilyDb(): Promise<{ familyId: string; client: KoreServerDbClient }> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  const client = await createClient();
  return { familyId, client };
}

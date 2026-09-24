import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ScopedIdentity = {
  userId: string | null;
  familyId: string | null;
};

/**
 * Una sola resolución de identidad por request de Next: `cache()` de React
 * deduplica en el servidor, así que getUser y el SELECT de profiles ocurren
 * una vez aunque requireFamilyDb, getScopedUserId y getScopedFamilyId
 * se llamen en la misma acción.
 */
export const getScopedIdentity = cache(async (): Promise<ScopedIdentity> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, familyId: null };

  const { data } = await supabase.from("profiles").select("family_id").eq("id", user.id).single();

  return {
    userId: user.id,
    familyId: data?.family_id ?? null,
  };
});

export async function getScopedUserId(): Promise<string | null> {
  return (await getScopedIdentity()).userId;
}

export async function getScopedFamilyId(): Promise<string | null> {
  return (await getScopedIdentity()).familyId;
}

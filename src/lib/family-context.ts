import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getScopedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

export const getScopedFamilyId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();
  return data?.family_id ?? null;
});

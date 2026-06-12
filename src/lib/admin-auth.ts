import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function getKoreAdminEmailAllowlist(): string | null {
  const email = normalizeEmail(process.env.KORE_ADMIN_EMAIL);
  return email || null;
}

export async function getKoreAdminUser() {
  const allowlist = getKoreAdminEmailAllowlist();
  if (!allowlist) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = normalizeEmail(user.email);
  if (!email || email !== allowlist) return null;
  return user;
}

/** Guard para Server Components — redirect silencioso. */
export async function requireKoreAdminPage() {
  const user = await getKoreAdminUser();
  if (!user) redirect("/");
  return user;
}

/** Guard para Server Actions — error explícito. */
export async function assertKoreAdminAction() {
  const user = await getKoreAdminUser();
  if (!user) throw new Error("No autorizado");
  return user;
}

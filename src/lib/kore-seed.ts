import type { Database } from "@/types/database";

import { ANDER_ID, LEIRE_ID } from "@/lib/kore-db";
import { getBrowserClient } from "@/lib/supabase/client";

type DomainAgent = Database["public"]["Tables"]["domains"]["Row"]["agent"];

/** UUIDs estables para los 6 dominios iniciales (alineados con `page.tsx`). */
const DOMAIN_SEED: Array<{
  id: string;
  name: string;
  owner_id: string | null;
  weight: number;
  agent: DomainAgent;
  grace_hours: number;
}> = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Menú",
    owner_id: ANDER_ID,
    weight: 8,
    agent: "economia",
    grace_hours: 48,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Sueño",
    owner_id: LEIRE_ID,
    weight: 15,
    agent: "armonia",
    grace_hours: 48,
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Limpieza",
    owner_id: LEIRE_ID,
    weight: 5,
    agent: "logistica",
    grace_hours: 48,
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Compras",
    owner_id: ANDER_ID,
    weight: 4,
    agent: "economia",
    grace_hours: 48,
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Colegio",
    owner_id: LEIRE_ID,
    weight: 6,
    agent: "logistica",
    grace_hours: 48,
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    name: "Tiempo Libre",
    owner_id: null,
    weight: 7,
    agent: "armonia",
    grace_hours: 48,
  },
];

/**
 * Inserta datos iniciales solo si las tablas están vacías.
 * Perfiles: Ander y Leire con `stress_level` 5.
 * Dominios: los 6 del shell actual con peso y agente.
 */
export async function seedInitialData(): Promise<{ profilesSeeded: boolean; domainsSeeded: boolean }> {
  const supabase = getBrowserClient();
  let profilesSeeded = false;
  let domainsSeeded = false;

  const { count: profileCount, error: countProfilesError } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  if (countProfilesError) {
    throw new Error(`seedInitialData: no se pudo contar profiles — ${countProfilesError.message}`);
  }

  if ((profileCount ?? 0) === 0) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles").insert([
      { id: ANDER_ID, name: "Ander", stress_level: 5, sleep_hours: null, updated_at: now },
      { id: LEIRE_ID, name: "Leire", stress_level: 5, sleep_hours: null, updated_at: now },
    ]);
    if (error) throw new Error(`seedInitialData: insert profiles — ${error.message}`);
    profilesSeeded = true;
  }

  const { count: domainCount, error: countDomainsError } = await supabase
    .from("domains")
    .select("*", { count: "exact", head: true });

  if (countDomainsError) {
    throw new Error(`seedInitialData: no se pudo contar domains — ${countDomainsError.message}`);
  }

  if ((domainCount ?? 0) === 0) {
    const rows = DOMAIN_SEED.map((d) => ({
      id: d.id,
      name: d.name,
      owner_id: d.owner_id,
      weight: d.weight,
      agent: d.agent,
      grace_hours: d.grace_hours,
      last_transfer_at: null as string | null,
    }));
    const { error } = await supabase.from("domains").insert(rows);
    if (error) throw new Error(`seedInitialData: insert domains — ${error.message}`);
    domainsSeeded = true;
  }

  return { profilesSeeded, domainsSeeded };
}

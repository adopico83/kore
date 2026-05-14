import { randomInt } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/** Alfabeto legible por voz (sin O/0 confundibles). */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Formato `KORE-` + 4 caracteres (p. ej. `KORE-A3X9`). */
export function generateInviteCode(): string {
  let body = "";
  for (let i = 0; i < 4; i += 1) {
    body += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]!;
  }
  return `KORE-${body}`;
}

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/^kore[-\s]*/i, "").replace(/[-\s]/g, "").toUpperCase();
}

/** Acepta `KORE-A3X9`, `kore-a3x9`, `A3X9` (se normaliza a 4 letras+dígitos del alfabeto). */
export function parseInviteCodeFromInput(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (/^kore-/i.test(trimmed)) {
    const m = trimmed.match(/^kore-([A-Z2-9]{4})$/i);
    return m ? `KORE-${m[1]!.toUpperCase()}` : null;
  }
  const compact = normalizeInviteCode(trimmed);
  if (compact.length === 4 && /^[A-Z2-9]{4}$/.test(compact)) {
    return `KORE-${compact}`;
  }
  return null;
}

/** Inserta una fila en `families` con `invite_code` único (reintenta si choca el unique). */
export async function insertFamilyWithUniqueInvite(
  admin: ReturnType<typeof createAdminClient>,
  familyName: string,
): Promise<{ id: string } | { error: string }> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const invite_code = generateInviteCode();
    const { data, error } = await admin
      .from("families")
      .insert({
        name: familyName,
        invite_code,
        onboarding_step: "pending",
      })
      .select("id")
      .single();

    if (!error && data?.id) {
      return { id: data.id };
    }
    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("duplicate") || msg.includes("unique") || error?.code === "23505") {
      continue;
    }
    return { error: error?.message || "No se pudo crear la familia." };
  }
  return { error: "No se pudo generar un código de invitación único." };
}

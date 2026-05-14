import type { Profile } from "@/lib/kore-db";

export type FamilyContext = {
  currentUser: Profile | null;
  adults: Profile[];
  children: Profile[];
  profileMap: Map<string, string>;
};

const PEQUE_REGEX = /\b(peques?|la\s+peque|el\s+peque|hij[oa]s?|niñ[oa]s?|infantil)\b/i;

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Adultos no-hijo, owner primero (misma regla que el contexto familiar en la home). */
export function sortedAdultsOwnerFirst(profiles: Profile[]): Profile[] {
  return profiles
    .filter((p) => p.role !== "child")
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return 0;
    });
}

export function getFamilyContext(profiles: Profile[], currentUserId: string): FamilyContext {
  const adults = sortedAdultsOwnerFirst(profiles);
  const children = profiles.filter((p) => p.role === "child");
  const currentUser = profiles.find((p) => p.id === currentUserId) ?? null;
  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));

  return { currentUser, adults, children, profileMap };
}

/** Primer adulto distinto del usuario (misma regla que el destinatario del Corcho en la home). */
export function resolvePartnerProfile(adults: Profile[], currentUserId: string): Profile | null {
  const id = currentUserId.trim();
  if (!id) return null;
  return adults.find((p) => p.id !== id) ?? null;
}

/**
 * Resuelve un nombre mostrado a `profiles.id`.
 * - Coincidencia de nombre case-insensitive (tras quitar acentos).
 * - Sinónimos de “peque” / hijo → primer perfil con `role === "child"`.
 * - No lanza; devuelve `null` si no hay match.
 */
export function resolveIdByName(nombre: string, profiles: Profile[]): string | null {
  const raw = (nombre ?? "").trim();
  if (!raw) return null;

  if (PEQUE_REGEX.test(raw)) {
    const child = profiles.find((p) => p.role === "child");
    return child?.id ?? null;
  }

  const needle = normalizeForMatch(raw);
  if (needle === "peque" || needle === "peques") {
    const child = profiles.find((p) => p.role === "child");
    return child?.id ?? null;
  }

  for (const p of profiles) {
    if (normalizeForMatch(p.name) === needle) return p.id;
  }
  return null;
}

/**
 * Resolución adicional para tokens legacy de los agentes ("Ander", "Leire")
 * cuando no coincide el nombre real: primer y segundo adulto (owner primero).
 */
export function resolveProfileIdFromAgentToken(raw: string, profiles: Profile[]): string | null {
  const byName = resolveIdByName(raw, profiles);
  if (byName) return byName;
  const key = normalizeForMatch(raw);
  if (key === "familia") return null;
  const adults = sortedAdultsOwnerFirst(profiles);
  if (key === "ander") return adults[0]?.id ?? null;
  if (key === "leire") return adults[1]?.id ?? null;
  return null;
}

/** Etiqueta legible para almacenar en campos de texto (p. ej. sueño): nombre del perfil o el token original. */
export function displayNameForAgentPersonToken(raw: string, profiles: Profile[]): string {
  const id = resolveProfileIdFromAgentToken(raw, profiles);
  if (id) return profiles.find((p) => p.id === id)?.name?.trim() || raw.trim();
  return raw.trim();
}

import type { Profile } from "@/lib/kore-db";

export type FamilyContext = {
  currentUser: Profile | null;
  adults: Profile[];
  children: Profile[];
  profileMap: Map<string, string>;
};

export function getFamilyContext(profiles: Profile[], currentUserId: string): FamilyContext {
  const adults = profiles
    .filter((p) => p.role !== "child")
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (b.role === "owner" && a.role !== "owner") return 1;
      return 0;
    });

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

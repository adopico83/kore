import { describe, expect, it } from "vitest";

import type { Profile } from "@/lib/kore-db";
import { getFamilyContext, resolvePartnerProfile } from "@/lib/family-utils";

function profile(p: Partial<Profile> & Pick<Profile, "id" | "name" | "role">): Profile {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    family_id: p.family_id ?? "fam-1",
    stress_level: p.stress_level ?? 5,
    sleep_hours: p.sleep_hours ?? null,
    updated_at: p.updated_at ?? new Date().toISOString(),
  };
}

describe("resolvePartnerProfile", () => {
  it("con dos adultos devuelve el que no es el usuario actual", () => {
    const adults = [
      profile({ id: "u-owner", name: "Ana", role: "owner" }),
      profile({ id: "u-member", name: "Luis", role: "member" }),
    ];
    expect(resolvePartnerProfile(adults, "u-owner")?.id).toBe("u-member");
    expect(resolvePartnerProfile(adults, "u-member")?.id).toBe("u-owner");
  });

  it("con un solo adulto devuelve null", () => {
    const adults = [profile({ id: "solo", name: "Solo", role: "owner" })];
    expect(resolvePartnerProfile(adults, "solo")).toBeNull();
  });

  it("con currentUserId vacío devuelve null", () => {
    const adults = [
      profile({ id: "a", name: "A", role: "owner" }),
      profile({ id: "b", name: "B", role: "member" }),
    ];
    expect(resolvePartnerProfile(adults, "")).toBeNull();
    expect(resolvePartnerProfile(adults, "   ")).toBeNull();
  });
});

describe("getFamilyContext", () => {
  it("clasifica adultos e hijos", () => {
    const profiles = [
      profile({ id: "o", name: "Owner", role: "owner" }),
      profile({ id: "m", name: "Member", role: "member" }),
      profile({ id: "c", name: "Niño", role: "child" }),
    ];
    const ctx = getFamilyContext(profiles, "m");
    expect(ctx.children).toHaveLength(1);
    expect(ctx.adults.map((a) => a.id)).toEqual(["o", "m"]);
    expect(ctx.currentUser?.id).toBe("m");
  });
});

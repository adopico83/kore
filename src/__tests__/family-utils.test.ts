import { describe, expect, it } from "vitest";

import type { Profile } from "@/lib/kore-db";
import {
  getFamilyContext,
  resolveIdByName,
  resolvePartnerProfile,
  resolveProfileIdFromAgentToken,
} from "@/lib/family-utils";

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

describe("resolveIdByName", () => {
  it("resuelve por nombre sin distinguir mayúsculas ni acentos", () => {
    const profiles = [
      profile({ id: "p1", name: "María", role: "owner" }),
      profile({ id: "p2", name: "Luis", role: "member" }),
    ];
    expect(resolveIdByName("maria", profiles)).toBe("p1");
    expect(resolveIdByName("MARÍA", profiles)).toBe("p1");
  });

  it("peque / hijo → primer perfil child", () => {
    const profiles = [
      profile({ id: "a", name: "Ana", role: "owner" }),
      profile({ id: "c", name: "Nina", role: "child" }),
    ];
    expect(resolveIdByName("peque", profiles)).toBe("c");
    expect(resolveIdByName("la peque", profiles)).toBe("c");
    expect(resolveIdByName("hijo", profiles)).toBe("c");
  });

  it("devuelve null si no hay match", () => {
    expect(resolveIdByName("nadie", [profile({ id: "a", name: "Ana", role: "owner" })])).toBeNull();
    expect(resolveIdByName("", [])).toBeNull();
  });
});

describe("resolveProfileIdFromAgentToken", () => {
  it("Ander/Leire mapean a primer y segundo adulto (owner primero)", () => {
    const profiles = [
      profile({ id: "owner", name: "Zoe", role: "owner" }),
      profile({ id: "mem", name: "Max", role: "member" }),
    ];
    expect(resolveProfileIdFromAgentToken("Ander", profiles)).toBe("owner");
    expect(resolveProfileIdFromAgentToken("Leire", profiles)).toBe("mem");
  });
});

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

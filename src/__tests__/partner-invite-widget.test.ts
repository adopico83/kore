import { describe, expect, it } from "vitest";

import { shouldShowPartnerInviteWidget } from "@/lib/family-utils";
import type { Profile } from "@/lib/kore-db";

const ownerProfile = { id: "owner-1", name: "Ana", role: "owner" } as Profile;
const memberProfile = { id: "member-1", name: "Luis", role: "member" } as Profile;

describe("shouldShowPartnerInviteWidget", () => {
  it("no muestra sin código de invitación", () => {
    expect(shouldShowPartnerInviteWidget(null, ownerProfile, false)).toBe(false);
    expect(shouldShowPartnerInviteWidget("   ", ownerProfile, false)).toBe(false);
  });

  it("no muestra si el usuario actual no es owner", () => {
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", memberProfile, false)).toBe(false);
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", memberProfile, true)).toBe(false);
  });

  it("muestra para owner con código y la pareja aún no tiene cuenta en auth", () => {
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", ownerProfile, false)).toBe(true);
  });

  it("no muestra cuando partnerHasAuthAccount (pareja con id en auth.users)", () => {
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", ownerProfile, true)).toBe(false);
  });

  it("no muestra si no hay perfil del usuario actual", () => {
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", null, false)).toBe(false);
    expect(shouldShowPartnerInviteWidget("KORE-A3X9", null, true)).toBe(false);
  });
});

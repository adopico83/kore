import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

describe("registerFamilyAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("con código de invitación enlaza al hogar existente sin insertar dominios", async () => {
    const insertProfiles = vi.fn().mockResolvedValue({ error: null });
    const selectFamilies = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { id: "fam-invite" }, error: null })),
      })),
    }));

    mockCreateAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn(async () => ({
            data: { user: { id: "user-join-1" } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "families") {
          return { select: selectFamilies };
        }
        if (table === "profiles") {
          return { insert: insertProfiles };
        }
        if (table === "domains") {
          return {
            insert: vi.fn(() => {
              throw new Error("no se deben crear dominios en alta por invitación");
            }),
          };
        }
        return {};
      }),
    });

    const { registerFamilyAction } = await import("@/lib/actions/register");
    const res = await registerFamilyAction("join@test.dev", "password123", "—", "Ana", {
      inviteCode: "KORE-A3X9",
    });

    expect(res).toEqual({ success: true });
    expect(insertProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-join-1",
        family_id: "fam-invite",
        role: "member",
      }),
    );
  });

  it("sin invitación crea familia, perfil owner y dominios base", async () => {
    const insertDomains = vi.fn().mockResolvedValue({ error: null });
    const insertProfiles = vi.fn().mockResolvedValue({ error: null });
    const updateFamilies = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    mockCreateAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn(async () => ({
            data: { user: { id: "user-new-1" } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "families") {
          return {
            insert: vi.fn(() => ({
              select: () => ({
                single: vi.fn(async () => ({ data: { id: "fam-new" }, error: null })),
              }),
            })),
            update: updateFamilies,
          };
        }
        if (table === "profiles") {
          return { insert: insertProfiles };
        }
        if (table === "domains") {
          return { insert: insertDomains };
        }
        return {};
      }),
    });

    const { registerFamilyAction } = await import("@/lib/actions/register");
    const res = await registerFamilyAction("new@test.dev", "password123", "Mi hogar", "Luis");

    expect(res).toEqual({ success: true });
    expect(insertProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-new-1",
        family_id: "fam-new",
        role: "owner",
      }),
    );
    expect(insertDomains).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

describe("admin-auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("getKoreAdminUser devuelve null sin KORE_ADMIN_EMAIL", async () => {
    vi.stubEnv("KORE_ADMIN_EMAIL", "");
    const { getKoreAdminUser } = await import("@/lib/admin-auth");
    const user = await getKoreAdminUser();
    expect(user).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("getKoreAdminUser devuelve null si el email no coincide", async () => {
    vi.stubEnv("KORE_ADMIN_EMAIL", "admin@test.com");
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "other@test.com" } }, error: null });
    const { getKoreAdminUser } = await import("@/lib/admin-auth");
    const user = await getKoreAdminUser();
    expect(user).toBeNull();
  });

  it("getKoreAdminUser devuelve el usuario si el email coincide", async () => {
    vi.stubEnv("KORE_ADMIN_EMAIL", "admin@test.com");
    const authUser = { id: "u1", email: "Admin@Test.com" };
    mockGetUser.mockResolvedValue({ data: { user: authUser }, error: null });
    const { getKoreAdminUser } = await import("@/lib/admin-auth");
    const user = await getKoreAdminUser();
    expect(user).toEqual(authUser);
  });

  it("assertKoreAdminAction lanza si no autorizado", async () => {
    vi.stubEnv("KORE_ADMIN_EMAIL", "admin@test.com");
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { assertKoreAdminAction } = await import("@/lib/admin-auth");
    await expect(assertKoreAdminAction()).rejects.toThrow("No autorizado");
  });
});

describe("kore-db admin", () => {
  it("getAdminStats devuelve counts", async () => {
    const select = vi.fn(async () => ({ count: 3, error: null }));
    const from = vi.fn(() => ({ select }));
    const client = { from };

    const { getAdminStats } = await import("@/lib/kore-db");
    const stats = await getAdminStats(client as never);

    expect(stats).toEqual({
      totalFamilies: 3,
      totalUsers: 3,
      totalPushSubscriptions: 3,
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("deleteFamilyCascade borra tablas scoped y la familia", async () => {
    const deletedTables: string[] = [];
    const families = [{ id: "fam-1" }];
    let ownerCleared = false;
    let profilesDeleted = false;
    let familyDeleted = false;

    const from = vi.fn((table: string) => {
      if (table === "families") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({ data: families[0], error: null })),
            }),
          }),
          update: (payload: { owner_id: null }) => ({
            eq: () => {
              if (payload.owner_id === null) ownerCleared = true;
              return Promise.resolve({ error: null });
            },
          }),
          delete: () => ({
            eq: () => {
              familyDeleted = true;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "profiles") {
        return {
          delete: () => ({
            eq: () => {
              profilesDeleted = true;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      return {
        delete: () => ({
          eq: () => {
            deletedTables.push(table);
            return Promise.resolve({ error: null });
          },
        }),
      };
    });

    const { deleteFamilyCascade } = await import("@/lib/kore-db");
    await deleteFamilyCascade({ from } as never, "fam-1");

    expect(deletedTables.length).toBeGreaterThan(10);
    expect(ownerCleared).toBe(true);
    expect(profilesDeleted).toBe(true);
    expect(familyDeleted).toBe(true);
  });

  it("deleteFamilyCascade lanza si la familia no existe", async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        }),
      }),
    }));

    const { deleteFamilyCascade } = await import("@/lib/kore-db");
    await expect(deleteFamilyCascade({ from } as never, "missing")).rejects.toThrow("Familia no encontrada");
  });
});

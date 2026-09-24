import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetScopedFamilyId = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@/lib/family-context", () => ({
  getScopedFamilyId: () => mockGetScopedFamilyId(),
  getScopedUserId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockDb = {
  getKoreNotes: vi.fn(),
  addKoreNote: vi.fn(),
  markNoteAsRead: vi.fn(),
  addEventLog: vi.fn(),
};

vi.mock("@/lib/kore-db", () => mockDb);

describe("requireFamilyDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no abre cliente si no hay familia", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const { requireFamilyDb } = await import("@/lib/family-db");
    await expect(requireFamilyDb()).rejects.toThrow("No family context");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("devuelve la familia validada y el cliente de sesión", async () => {
    const client = { from: vi.fn() };
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-9");
    mockCreateClient.mockResolvedValueOnce(client);
    const { requireFamilyDb } = await import("@/lib/family-db");
    await expect(requireFamilyDb()).resolves.toEqual({ familyId: "fam-9", client });
  });
});

describe("acceso a datos con sesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getKoreNotes exige familia y pasa el cliente de sesión", async () => {
    const client = { from: vi.fn() };
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-1");
    mockCreateClient.mockResolvedValueOnce(client);
    mockDb.getKoreNotes.mockResolvedValueOnce([]);
    const mod = await import("@/lib/actions/corcho");
    await mod.getKoreNotes("user-2");
    expect(mockDb.getKoreNotes).toHaveBeenCalledWith(client, "fam-1", "user-2");
  });

  it("getKoreNotes sin familia no consulta notas", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/corcho");
    await expect(mod.getKoreNotes()).rejects.toThrow("No family context");
    expect(mockDb.getKoreNotes).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("logQuickEvent exige familia y usuario antes de escribir", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/events");
    await expect(mod.logQuickEvent("hola", "note")).rejects.toThrow("No family context");
    expect(mockDb.addEventLog).not.toHaveBeenCalled();
  });
});

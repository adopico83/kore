import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetScopedFamilyId = vi.fn();

vi.mock("@/lib/family-context", () => ({
  getScopedFamilyId: mockGetScopedFamilyId,
}));

const mockDb = {
  getProfiles: vi.fn(),
  updateStressLevel: vi.fn(),
  getCalendarEvents: vi.fn(),
  addCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  getKoreNotes: vi.fn(),
  addKoreNote: vi.fn(),
  markNoteAsRead: vi.fn(),
  getExpenses: vi.fn(),
  addExpense: vi.fn(),
  deleteExpense: vi.fn(),
};

vi.mock("@/lib/kore-db", () => mockDb);

describe("server actions critical domains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("profiles.getProfiles: con familyId llama a db con familyId", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-1");
    mockDb.getProfiles.mockResolvedValueOnce([]);
    const mod = await import("@/lib/actions/profiles");
    await mod.getProfiles();
    expect(mockDb.getProfiles).toHaveBeenCalledWith("fam-1");
  });

  it("profiles.getProfiles: sin familyId lanza No family context", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/profiles");
    await expect(mod.getProfiles()).rejects.toThrow("No family context");
  });

  it("calendar.getCalendarEvents: con familyId llama a db con familyId", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-1");
    mockDb.getCalendarEvents.mockResolvedValueOnce([]);
    const mod = await import("@/lib/actions/calendar");
    await mod.getCalendarEvents();
    expect(mockDb.getCalendarEvents).toHaveBeenCalledWith("fam-1");
  });

  it("calendar.getCalendarEvents: sin familyId lanza No family context", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/calendar");
    await expect(mod.getCalendarEvents()).rejects.toThrow("No family context");
  });

  it("corcho.getKoreNotes: con familyId llama a db con familyId", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-1");
    mockDb.getKoreNotes.mockResolvedValueOnce([]);
    const mod = await import("@/lib/actions/corcho");
    await mod.getKoreNotes();
    expect(mockDb.getKoreNotes).toHaveBeenCalledWith("fam-1", undefined);
  });

  it("corcho.getKoreNotes: sin familyId lanza No family context", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/corcho");
    await expect(mod.getKoreNotes()).rejects.toThrow("No family context");
  });

  it("expenses.getExpenses: con familyId llama a db con familyId", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce("fam-1");
    mockDb.getExpenses.mockResolvedValueOnce([]);
    const mod = await import("@/lib/actions/expenses");
    await mod.getExpenses();
    expect(mockDb.getExpenses).toHaveBeenCalledWith("fam-1");
  });

  it("expenses.getExpenses: sin familyId lanza No family context", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const mod = await import("@/lib/actions/expenses");
    await expect(mod.getExpenses()).rejects.toThrow("No family context");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

describe("getScopedFamilyId", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    });
  });

  it("sin usuario devuelve null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const { getScopedFamilyId } = await import("@/lib/family-context");
    const familyId = await getScopedFamilyId();
    expect(familyId).toBeNull();
  });

  it("usuario con family_id devuelve UUID", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: { family_id: "8378283a-cfc0-46ec-90c0-07e45c885aee" },
    });

    const { getScopedFamilyId } = await import("@/lib/family-context");
    const familyId = await getScopedFamilyId();

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockSelect).toHaveBeenCalledWith("family_id");
    expect(mockEq).toHaveBeenCalledWith("id", "u1");
    expect(familyId).toBe("8378283a-cfc0-46ec-90c0-07e45c885aee");
  });

  it("usuario sin family_id devuelve null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u2" } } });
    mockSingle.mockResolvedValueOnce({
      data: { family_id: null },
    });

    const { getScopedFamilyId } = await import("@/lib/family-context");
    const familyId = await getScopedFamilyId();
    expect(familyId).toBeNull();
  });
});

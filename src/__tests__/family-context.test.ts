import { beforeEach, describe, expect, it, vi } from "vitest";

const slots = vi.hoisted(() => new Map<unknown, Map<string, unknown>>());

const mockCreateClient = vi.fn();
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache<T extends (...args: never[]) => unknown>(fn: T): T {
      return ((...args: never[]) => {
        const key = JSON.stringify(args);
        let bucket = slots.get(fn);
        if (!bucket) {
          bucket = new Map();
          slots.set(fn, bucket);
        }
        if (!bucket.has(key)) bucket.set(key, fn(...args));
        return bucket.get(key);
      }) as T;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

describe("getScopedIdentity", () => {
  beforeEach(() => {
    slots.clear();
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
    expect(mockFrom).not.toHaveBeenCalled();
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

  it("user id y family id salen de un getUser y un profile", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValue({
      data: { family_id: "8378283a-cfc0-46ec-90c0-07e45c885aee" },
    });

    const { getScopedUserId, getScopedFamilyId } = await import("@/lib/family-context");
    const [userId, familyId] = await Promise.all([getScopedUserId(), getScopedFamilyId()]);

    expect(userId).toBe("u1");
    expect(familyId).toBe("8378283a-cfc0-46ec-90c0-07e45c885aee");
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith("family_id");
  });
});

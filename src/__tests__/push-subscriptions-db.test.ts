import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAMILY_ID, getSubscriptionsByFamily, saveSubscription } from "@/lib/kore-db";

const { mockGetBrowserClient } = vi.hoisted(() => ({
  mockGetBrowserClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: mockGetBrowserClient,
}));

describe("push_subscriptions kore-db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saveSubscription sustituye misma endpoint (select + insert)", async () => {
    const inserted = {
      id: "ps-1",
      profile_id: "u1",
      family_id: FAMILY_ID,
      subscription_data: {
        endpoint: "https://push.test/ep",
        keys: { p256dh: "dh", auth: "au" },
      },
      device_type: "desktop",
      created_at: "2026-01-01T00:00:00Z",
    };
    const insert = vi.fn(() => ({
      select: () => ({ single: vi.fn(async () => ({ data: inserted, error: null })) }),
    }));
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return {
          select: () => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          }),
        };
      }
      return { insert };
    });
    mockGetBrowserClient.mockReturnValue({ from });

    const row = await saveSubscription("u1", FAMILY_ID, {
      endpoint: "https://push.test/ep",
      keys: { p256dh: "dh", auth: "au" },
    }, "desktop");

    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "u1",
        family_id: FAMILY_ID,
        subscription_data: {
          endpoint: "https://push.test/ep",
          keys: { p256dh: "dh", auth: "au" },
        },
        device_type: "desktop",
      }),
    );
    expect(row).toEqual(inserted);
  });

  it("saveSubscription propaga error de insert", async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: "insert fail" } }));
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) {
        return {
          select: () => ({
            eq: vi.fn(async () => ({ data: [], error: null })),
          }),
        };
      }
      return {
        insert: () => ({
          select: () => ({ single }),
        }),
      };
    });
    mockGetBrowserClient.mockReturnValue({ from });

    await expect(
      saveSubscription("u1", FAMILY_ID, { endpoint: "https://x", keys: { p256dh: "a", auth: "b" } }),
    ).rejects.toThrow("saveSubscription: insert fail");
  });

  it("getSubscriptionsByFamily reconstruye subscription_data para web-push", async () => {
    const rows = [
      {
        id: "1",
        subscription_data: { endpoint: "https://e", keys: { p256dh: "x", auth: "y" } },
      },
    ];
    const order = vi.fn(async () => ({ data: rows, error: null }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    mockGetBrowserClient.mockReturnValue({ from });

    const out = await getSubscriptionsByFamily(FAMILY_ID);

    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(out).toEqual([
      { id: "1", subscription: { endpoint: "https://e", keys: { p256dh: "x", auth: "y" } } },
    ]);
  });

  it("getSubscriptionsByFamily devuelve [] si Supabase falla", async () => {
    const order = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    mockGetBrowserClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ order }) }) }),
    });

    const out = await getSubscriptionsByFamily(FAMILY_ID);
    expect(out).toEqual([]);
  });
});

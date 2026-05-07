import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAMILY_ID, addKoreNote, getDomains, getProfiles } from "@/lib/kore-db";

const { mockGetBrowserClient } = vi.hoisted(() => ({
  mockGetBrowserClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: mockGetBrowserClient,
}));

function createSelectBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(async () => result),
  };
  return builder;
}

describe("kore-db critical queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getProfiles aplica family_id y devuelve filas", async () => {
    const builder = createSelectBuilder({
      data: [{ id: "1", name: "Ander" }],
      error: null,
    });
    const client = { from: vi.fn(() => builder) };
    mockGetBrowserClient.mockReturnValue(client);

    const rows = await getProfiles();

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(rows).toEqual([{ id: "1", name: "Ander" }]);
  });

  it("getDomains devuelve [] cuando hay error", async () => {
    const builder = createSelectBuilder({
      data: null,
      error: { message: "boom" },
    });
    mockGetBrowserClient.mockReturnValue({ from: vi.fn(() => builder) });

    const rows = await getDomains();

    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(rows).toEqual([]);
  });

  it("addKoreNote inserta con family_id y devuelve la fila creada", async () => {
    const single = vi.fn(async () => ({ data: { id: "note-1", content: "hola" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    mockGetBrowserClient.mockReturnValue({ from });

    const row = await addKoreNote({
      sender_id: "u1",
      recipient_id: "u2",
      content: "hola",
      status: "unread",
      priority: "medium",
    });

    expect(from).toHaveBeenCalledWith("kore_notes");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        family_id: FAMILY_ID,
        content: "hola",
      }),
    );
    expect(row).toEqual({ id: "note-1", content: "hola" });
  });
});

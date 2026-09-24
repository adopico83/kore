import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAMILY_ID, addEventLog, addKoreNote, getDomains, getKoreNotes, getProfiles } from "@/lib/kore-db";

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

  it("getProfiles exige un cliente y filtra por family_id", async () => {
    const builder = createSelectBuilder({
      data: [{ id: "1", name: "Ander" }],
      error: null,
    });
    const client = { from: vi.fn(() => builder) };

    const rows = await getProfiles(client as never, FAMILY_ID);

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(rows).toEqual([{ id: "1", name: "Ander" }]);
  });

  it("getProfiles devuelve [] cuando hay error de Supabase", async () => {
    const builder = createSelectBuilder({
      data: null,
      error: { message: "boom" },
    });
    const client = { from: vi.fn(() => builder) };

    const rows = await getProfiles(client as never, FAMILY_ID);

    expect(rows).toEqual([]);
  });

  it("getDomains devuelve [] cuando hay error", async () => {
    const builder = createSelectBuilder({
      data: null,
      error: { message: "boom" },
    });
    const builderClient = { from: vi.fn(() => builder) };

    const rows = await getDomains(builderClient as never, FAMILY_ID);

    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(rows).toEqual([]);
  });

  it("getDomains aplica filtro family_id correctamente", async () => {
    const builder = createSelectBuilder({
      data: [{ id: "d1", name: "Compras" }],
      error: null,
    });
    const client = { from: vi.fn(() => builder) };

    const rows = await getDomains(client as never, FAMILY_ID);

    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(rows).toEqual([{ id: "d1", name: "Compras" }]);
  });

  it("getKoreNotes filtra por familia en el cliente recibido", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then(onfulfilled: (value: { data: unknown[]; error: null }) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(onfulfilled);
      },
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    const client = { from: vi.fn(() => builder) };

    await getKoreNotes(client as never, FAMILY_ID, "user-2");

    expect(client.from).toHaveBeenCalledWith("kore_notes");
    expect(builder.eq).toHaveBeenCalledWith("family_id", FAMILY_ID);
    expect(builder.eq).toHaveBeenCalledWith("recipient_id", "user-2");
  });

  it("addKoreNote inserta con family_id y devuelve la fila creada", async () => {
    const single = vi.fn(async () => ({ data: { id: "note-1", content: "hola" }, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const client = { from };

    const row = await addKoreNote(client as never, FAMILY_ID, {
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

  it("addKoreNote lanza error cuando Supabase devuelve error", async () => {
    const single = vi.fn(async () => ({
      data: null,
      error: { message: "insert failed" },
    }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ insert })) };

    await expect(
      addKoreNote(client as never, FAMILY_ID, {
        sender_id: "u1",
        recipient_id: "u2",
        content: "hola",
        status: "unread",
        priority: "medium",
      }),
    ).rejects.toThrow("addKoreNote: insert failed");
  });

  it("addEventLog escribe family_id y user_id de la sesión", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ insert }));
    const client = { from };

    await addEventLog(client as never, FAMILY_ID, "user-1", {
      type: "note",
      raw_input: "comprar leche",
    });

    expect(from).toHaveBeenCalledWith("events_log");
    expect(insert).toHaveBeenCalledWith({
      family_id: FAMILY_ID,
      user_id: "user-1",
      type: "note",
      raw_input: "comprar leche",
      domain_id: null,
    });
  });
});

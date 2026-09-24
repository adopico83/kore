import { describe, expect, it } from "vitest";

import { commitHealthRecord, calendarEventFromHealthRecord } from "@/lib/kore-salud-sync";
import type { HealthRecord, Profile } from "@/lib/kore-db";
import {
  applyListMutation,
  applySaludAction,
  mergeCorchoMessage,
  mergeRemoteRow,
  readShoppingItem,
  removeSaludItem,
  upsertById,
} from "@/lib/optimistic-state";

type Item = { id: string; name: string; completed: boolean; pending?: boolean };

const leche: Item = { id: "a", name: "leche", completed: false };
const pan: Item = { id: "b", name: "pan", completed: false };

describe("actualización optimista de listas", () => {
  it("añade, marca y quita sin duplicar el mismo id", () => {
    const added = applyListMutation([pan], { type: "add", item: { ...leche, pending: true } });
    expect(added.map((item) => item.id)).toEqual(["a", "b"]);

    const again = applyListMutation(added, { type: "add", item: leche });
    expect(again).toHaveLength(2);

    const done = applyListMutation(added, { type: "patch", id: "a", patch: { completed: true, pending: false } });
    expect(done.find((item) => item.id === "a")).toMatchObject({ completed: true, pending: false });

    expect(applyListMutation(done, { type: "remove", id: "a" }).map((item) => item.id)).toEqual(["b"]);
  });

  it("reconcilia la fila del servidor en el mismo id", () => {
    const pending: Item[] = [{ ...leche, pending: true }];
    const saved = upsertById(pending, { id: "a", name: "leche", completed: false }, "start");
    expect(saved).toEqual([{ id: "a", name: "leche", completed: false }]);
  });
});

describe("mezcla por id de Realtime", () => {
  it("un insert del mismo id no duplica la escritura propia", () => {
    const current = [leche];
    const merged = mergeRemoteRow(current, { event: "INSERT", id: "a", row: { ...leche, name: "leche entera" } }, "start");
    expect(merged).toEqual([{ id: "a", name: "leche entera", completed: false }]);
  });

  it("un delete quita por id y un payload incompleto pide relectura", () => {
    expect(mergeRemoteRow([leche, pan], { event: "DELETE", id: "a", row: null })).toEqual([pan]);
    expect(mergeRemoteRow([leche], { event: "DELETE", id: null, row: null })).toBeNull();
    expect(mergeRemoteRow([leche], { event: "INSERT", id: null, row: null })).toBeNull();
  });

  it("lee una fila de compra y descarta un payload a medias", () => {
    expect(readShoppingItem({ id: "a", name: "leche", completed: false })).toMatchObject({ id: "a", name: "leche" });
    expect(readShoppingItem({ id: "a" })).toBeNull();
  });
});

describe("salud y corcho", () => {
  it("pinta la cita al momento y la confirma con el registro devuelto", () => {
    const base = { ander: { citas: [], medicaciones: [] } };
    const pending = applySaludAction(base, {
      type: "add-cita",
      memberId: "ander",
      cita: { id: "tmp", descripcion: "Pediatra", pending: true },
    });
    expect(pending.ander?.citas).toEqual([{ id: "tmp", descripcion: "Pediatra", pending: true }]);

    const record = {
      id: "tmp",
      type: "appointment",
      patient_id: "ander",
      description: JSON.stringify({
        v: 2,
        kind: "cita",
        patient_id: "ander",
        descripcion: "Pediatra",
        fecha: "2026-09-24",
        hora: "10:30",
        lugar: "Centro",
        calendar_event_id: "cal-1",
      }),
      date_time: "2026-09-24T10:30:00",
      next_dose_at: null,
      status: "pending",
      created_at: "2026-09-24T09:00:00.000Z",
      family_id: "fam",
    } as HealthRecord;

    const profiles = [{ id: "ander", name: "Ander" }] as Profile[];
    const committed = commitHealthRecord(base, profiles, record, "tmp");
    expect(committed.ander?.citas).toEqual([
      { id: "tmp", descripcion: "Pediatra", fecha: "2026-09-24", hora: "10:30", lugar: "Centro" },
    ]);
    expect(calendarEventFromHealthRecord(record)).toMatchObject({
      id: "cal-1",
      date: "2026-09-24",
      time: "10:30",
    });
  });

  it("quita una cita por id y conserva las fotos ya firmadas del corcho", () => {
    const removed = removeSaludItem(
      { ander: { citas: [{ id: "c1" }, { id: "c2" }], medicaciones: [{ id: "m1" }] } },
      "c1",
    );
    expect(removed.ander?.citas.map((cita) => cita.id)).toEqual(["c2"]);

    const messages = [{ id: "n1", imageUrls: ["https://signed"], pending: true, text: "hola" }];
    const merged = mergeCorchoMessage(messages, { id: "n1", imageUrls: [], pending: true, text: "hola" });
    expect(merged).toEqual([{ id: "n1", imageUrls: ["https://signed"], pending: false, text: "hola" }]);
  });
});

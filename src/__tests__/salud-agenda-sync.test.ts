import { describe, expect, it } from "vitest";

import { applyGuardrails } from "@/lib/agent/guardrails";
import {
  addHealthRecordRow,
  deleteHealthRecordRow,
  updateHealthRecordRow,
  type HealthRecord,
  type KoreServerDbClient,
} from "@/lib/kore-db";
import {
  agendaFieldsForAppointment,
  buildCitaHealthInsert,
  calendarEventIdFromDescription,
  describeAppointment,
} from "@/lib/kore-salud-sync";

type Row = Record<string, unknown>;

function createClient(options?: { healthInsertError?: string; existing?: HealthRecord | null }) {
  const calendarInserts: Row[] = [];
  const healthInserts: Row[] = [];
  const calendarUpdates: Row[] = [];
  const calendarDeletes: string[] = [];
  const healthUpdates: Row[] = [];
  const healthDeletes: string[] = [];
  let calendarSeq = 0;

  const client = {
    from(table: string) {
      if (table === "calendar_events") {
        return {
          insert(row: Row) {
            calendarSeq += 1;
            const created = { id: `cal-${calendarSeq}`, ...row };
            calendarInserts.push(created);
            return { select: () => ({ single: async () => ({ data: created, error: null }) }) };
          },
          update(row: Row) {
            calendarUpdates.push(row);
            return { eq: () => ({ eq: async () => ({ error: null }) }) };
          },
          delete() {
            return {
              eq: () => ({
                eq: (_column: string, id: string) => {
                  calendarDeletes.push(id);
                  return Promise.resolve({ error: null });
                },
              }),
            };
          },
        };
      }

      return {
        insert(row: Row) {
          if (options?.healthInsertError) {
            return {
              select: () => ({
                single: async () => ({ data: null, error: { message: options.healthInsertError } }),
              }),
            };
          }
          const created = { id: "hr-1", created_at: null, ...row };
          healthInserts.push(created);
          return { select: () => ({ single: async () => ({ data: created, error: null }) }) };
        },
        select() {
          return {
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: options?.existing ?? null, error: null }),
              }),
            }),
          };
        },
        update(row: Row) {
          healthUpdates.push(row);
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
        delete() {
          return {
            eq: () => ({
              eq: (_column: string, id: string) => {
                healthDeletes.push(id);
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };
    },
  };

  return { client: client as unknown as KoreServerDbClient, calendarInserts, healthInserts, calendarUpdates, calendarDeletes, healthUpdates, healthDeletes };
}

describe("citas y agenda", () => {
  it("describe una cita JSON sin mostrar el blob", () => {
    const insert = buildCitaHealthInsert("ander", {
      descripcion: "Pediatra",
      fecha: "2026-09-23",
      hora: "10:30",
      lugar: "Ambulatorio",
    });
    const view = describeAppointment(insert.description, insert.date_time);
    expect(view).toEqual({
      descripcion: "Pediatra",
      fecha: "2026-09-23",
      hora: "10:30",
      lugar: "Ambulatorio",
    });
    expect(agendaFieldsForAppointment(insert.description, insert.date_time)).toEqual({
      title: "Cita · Pediatra · Ambulatorio",
      date: "2026-09-23",
      time: "10:30",
    });
  });

  it("al crear una cita escribe el registro y el evento de agenda enlazados", async () => {
    const db = createClient();
    const insert = buildCitaHealthInsert("ander", {
      descripcion: "Pediatra",
      fecha: "2026-09-23",
      hora: "10:30",
      lugar: "Ambulatorio",
    });

    const row = await addHealthRecordRow(db.client, "fam-1", insert);

    expect(db.calendarInserts).toHaveLength(1);
    expect(db.calendarInserts[0]).toMatchObject({
      title: "Cita · Pediatra · Ambulatorio",
      date: "2026-09-23",
      time: "10:30",
      family_id: "fam-1",
      created_by: "ander",
    });
    expect(calendarEventIdFromDescription(String(row.description))).toBe("cal-1");
    expect(describeAppointment(String(row.description), row.date_time).descripcion).toBe("Pediatra");
    expect(db.healthInserts[0]).toMatchObject({ family_id: "fam-1", type: "appointment" });
  });

  it("una medicación no crea evento de agenda", async () => {
    const db = createClient();
    await addHealthRecordRow(db.client, "fam-1", {
      patient_id: "ander",
      type: "medication",
      description: "Ibuprofeno",
      date_time: null,
      next_dose_at: "2026-09-23T10:30",
      status: "active",
    });
    expect(db.calendarInserts).toHaveLength(0);
    expect(db.healthInserts).toHaveLength(1);
  });

  it("si la cita no se guarda, retira el evento de agenda", async () => {
    const db = createClient({ healthInsertError: "rlc" });
    const insert = buildCitaHealthInsert("ander", {
      descripcion: "Pediatra",
      fecha: "2026-09-23",
      hora: "10:30",
      lugar: "",
    });
    await expect(addHealthRecordRow(db.client, "fam-1", insert)).rejects.toThrow(/addHealthRecordRow/);
    expect(db.calendarDeletes).toEqual(["cal-1"]);
  });

  it("al editar una cita actualiza la misma fila de agenda", async () => {
    const existing = {
      id: "hr-1",
      patient_id: "ander",
      type: "appointment",
      description: buildCitaHealthInsert("ander", {
        descripcion: "Pediatra",
        fecha: "2026-09-23",
        hora: "10:30",
        lugar: "",
      }).description,
      date_time: "2026-09-23T10:30:00",
      next_dose_at: null,
      status: "pending",
      family_id: "fam-1",
      created_at: null,
    } as HealthRecord;
    const linked = JSON.parse(existing.description) as { calendar_event_id?: string };
    linked.calendar_event_id = "cal-9";
    existing.description = JSON.stringify(linked);

    const db = createClient({ existing });
    await updateHealthRecordRow(db.client, "fam-1", "hr-1", {
      patient_id: "ander",
      description: buildCitaHealthInsert("ander", {
        descripcion: "Revisión",
        fecha: "2026-09-24",
        hora: "11:00",
        lugar: "Centro",
      }).description,
      date_time: "2026-09-24T11:00:00",
    });

    expect(db.calendarUpdates[0]).toMatchObject({
      title: "Cita · Revisión · Centro",
      date: "2026-09-24",
      time: "11:00",
    });
    expect(db.calendarInserts).toHaveLength(0);
    expect(calendarEventIdFromDescription(String(db.healthUpdates[0]?.description))).toBe("cal-9");
  });

  it("al borrar una cita borra su evento de agenda", async () => {
    const description = JSON.parse(
      buildCitaHealthInsert("ander", {
        descripcion: "Pediatra",
        fecha: "2026-09-23",
        hora: "10:30",
        lugar: "",
      }).description,
    ) as { calendar_event_id?: string };
    description.calendar_event_id = "cal-9";
    const db = createClient({
      existing: {
        id: "hr-1",
        patient_id: "ander",
        type: "appointment",
        description: JSON.stringify(description),
        date_time: "2026-09-23T10:30:00",
        next_dose_at: null,
        status: "pending",
        family_id: "fam-1",
        created_at: null,
      },
    });

    await deleteHealthRecordRow(db.client, "fam-1", "hr-1");
    expect(db.calendarDeletes).toEqual(["cal-9"]);
    expect(db.healthDeletes).toEqual(["hr-1"]);
  });

  it("el plan del agente no añade un segundo evento al crear una cita", () => {
    const plan = applyGuardrails(
      [{ tool: "add_appointment", args: { description: "Pediatra", date: "2026-09-23", time: "10:30", patient: "Ander" } }],
      "añade cita de pediatra para Ander mañana a las 10:30",
    );
    expect(plan.map((item) => item.tool)).toEqual(["add_appointment"]);
  });

  it("el plan del agente sigue emparejando un evento escolar con la agenda", () => {
    const plan = applyGuardrails(
      [{ tool: "add_school_event", args: { title: "Excursión", date: "2026-09-23", time: "09:00" } }],
      "añade excursión el 23 de septiembre",
    );
    expect(plan.map((item) => item.tool)).toEqual(["add_school_event", "add_calendar_event"]);
  });
});

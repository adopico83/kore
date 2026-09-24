import { resolveIdByName, resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import type { HealthRecord, HealthRecordInsert, Profile } from "@/lib/kore-db";
import { removeSaludItem, upsertById } from "@/lib/optimistic-state";

export type MappedSaludCita = { id: string; descripcion: string; fecha: string; hora: string; lugar: string };
export type MappedSaludMedicacion = {
  id: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
  proximaToma: string;
};

/** Misma forma que `SaludData` en `SaludModal` (claves = profile id). */
export type MappedSaludData = Record<string, { citas: MappedSaludCita[]; medicaciones: MappedSaludMedicacion[] }>;

type KoreCitaPayloadV1 = {
  v: 1;
  kind: "cita";
  member: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
  /** Evento de agenda creado junto con la cita. */
  calendar_event_id?: string;
};

type KoreMedPayloadV1 = {
  v: 1;
  kind: "med";
  member: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
};

type KoreCitaPayloadV2 = {
  v: 2;
  kind: "cita";
  patient_id: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
  /** Evento de agenda creado junto con la cita. */
  calendar_event_id?: string;
};

type KoreMedPayloadV2 = {
  v: 2;
  kind: "med";
  patient_id: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
};

type KorePayload = KoreCitaPayloadV1 | KoreMedPayloadV1 | KoreCitaPayloadV2 | KoreMedPayloadV2;

function emptyMember(): { citas: MappedSaludCita[]; medicaciones: MappedSaludMedicacion[] } {
  return { citas: [], medicaciones: [] };
}

export function emptySaludForProfiles(profiles: Profile[]): MappedSaludData {
  return Object.fromEntries((profiles ?? []).map((p) => [p.id, emptyMember()])) as MappedSaludData;
}

function parseJsonPayload(description: string): KorePayload | null {
  try {
    const p = JSON.parse(description) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as { v?: unknown; kind?: unknown };
    const v = o.v;
    if (v !== 1 && v !== 2) return null;
    if (o.kind === "cita" || o.kind === "med") return p as KorePayload;
    return null;
  } catch {
    return null;
  }
}

/** Prioriza `patient_id` en JSON v2; en v1 con `profiles` re-mapea `member` al id real. */
export function resolveHealthBucketPatientId(r: HealthRecord, profiles: Profile[]): string {
  const payload = parseJsonPayload(r.description);
  if (payload && payload.v === 2 && "patient_id" in payload && typeof payload.patient_id === "string" && payload.patient_id.trim()) {
    return payload.patient_id.trim();
  }
  if (payload && payload.v === 1 && "member" in payload && typeof payload.member === "string" && (profiles?.length ?? 0) > 0) {
    const resolved =
      resolveIdByName(payload.member, profiles) ?? resolveProfileIdFromAgentToken(payload.member, profiles);
    if (resolved) return resolved;
  }
  return (r.patient_id ?? "").trim();
}

/** Construye `date_time` ISO local-friendly a partir de fecha + hora (YYYY-MM-DD, HH:mm). */
function dateTimeFromParts(fecha: string, hora: string): string {
  const h = (hora ?? "").trim().length >= 5 ? hora.trim() : "00:00";
  return `${fecha}T${h}:00`;
}

export function calendarEventIdFromDescription(description: string | null | undefined): string | null {
  try {
    const parsed = JSON.parse(description ?? "") as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const id = (parsed as { calendar_event_id?: unknown }).calendar_event_id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/** Texto visible de una cita, tanto si `description` es JSON v1/v2 como texto plano. */
export function describeAppointment(
  description: string | null | undefined,
  dateTime: string | null | undefined,
): { descripcion: string; fecha: string; hora: string; lugar: string } {
  const payload = parseJsonPayload(description ?? "");
  const dt = (dateTime ?? "").trim();
  const [dtFecha, rest] = dt.includes("T") ? dt.split("T") : [dt, ""];
  const dtHora = rest ? rest.slice(0, 5) : "";
  if (payload && payload.kind === "cita") {
    return {
      descripcion: payload.descripcion,
      fecha: (payload.fecha || dtFecha).slice(0, 10),
      hora: (payload.hora || dtHora).slice(0, 5),
      lugar: "lugar" in payload ? (payload.lugar ?? "") : "",
    };
  }
  return {
    descripcion: (description ?? "").trim(),
    fecha: (dtFecha ?? "").slice(0, 10),
    hora: dtHora,
    lugar: "",
  };
}

export function describeMedication(
  description: string | null | undefined,
  nextDose: string | null | undefined,
): { nombre: string; dosis: string; frecuenciaHoras: number; proximaToma: string } {
  const payload = parseJsonPayload(description ?? "");
  if (payload && payload.kind === "med") {
    return {
      nombre: payload.nombre,
      dosis: payload.dosis,
      frecuenciaHoras: payload.frecuenciaHoras,
      proximaToma: nextDose ?? "",
    };
  }
  return {
    nombre: (description ?? "").slice(0, 120),
    dosis: "",
    frecuenciaHoras: 0,
    proximaToma: nextDose ?? "",
  };
}

/** Título, día y hora para la fila de `calendar_events` que representa la cita. */
export function agendaFieldsForAppointment(
  description: string | null | undefined,
  dateTime: string | null | undefined,
): { title: string; date: string; time: string } | null {
  const view = describeAppointment(description, dateTime);
  const date = view.fecha.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = /^(\d{2}:\d{2})/.exec(view.hora.trim())?.[1] ?? "09:00";
  const base = (view.descripcion.trim() || "Cita médica").slice(0, 140);
  const lugar = view.lugar.trim();
  const title = (lugar ? `Cita · ${base} · ${lugar}` : `Cita · ${base}`).slice(0, 180);
  return { title, date, time };
}

/** Guarda el id del evento de agenda dentro de la descripción, sin perder el texto de la cita. */
export function descriptionWithCalendarEventId(
  description: string,
  calendarEventId: string,
  fallback: { patientId: string; fecha: string; hora: string; lugar?: string },
): string {
  const payload = parseJsonPayload(description);
  if (payload && payload.kind === "cita") {
    return JSON.stringify({ ...payload, calendar_event_id: calendarEventId });
  }
  return JSON.stringify({
    v: 2,
    kind: "cita",
    patient_id: fallback.patientId,
    descripcion: description.trim(),
    fecha: fallback.fecha,
    hora: fallback.hora,
    lugar: fallback.lugar ?? "",
    calendar_event_id: calendarEventId,
  } satisfies KoreCitaPayloadV2);
}

/** La cita ya trae el id de agenda en la descripción: la UI lo pinta sin otra lectura. */
export function calendarEventFromHealthRecord(record: Pick<
  HealthRecord,
  "type" | "description" | "date_time" | "patient_id" | "created_at"
>): { id: string; title: string; date: string; time: string; created_by: string | null; created_at: string } | null {
  if (record.type !== "appointment") return null;
  const id = calendarEventIdFromDescription(record.description);
  const fields = agendaFieldsForAppointment(record.description, record.date_time);
  if (!id || !fields) return null;
  return {
    id,
    title: fields.title,
    date: fields.date,
    time: fields.time,
    created_by: record.patient_id,
    created_at: record.created_at ?? "",
  };
}

export function saludFromHealthRecords(rows: HealthRecord[], profiles: Profile[]): MappedSaludData {
  const out = emptySaludForProfiles(profiles);
  const ensure = (pid: string) => {
    if (!out[pid]) out[pid] = emptyMember();
  };

  for (const r of rows) {
    const memberKey = resolveHealthBucketPatientId(r, profiles);
    if (!memberKey) continue;
    ensure(memberKey);

    if (r.type === "appointment") {
      out[memberKey].citas.push({ id: r.id, ...describeAppointment(r.description, r.date_time) });
      continue;
    }

    if (r.type === "medication") {
      out[memberKey].medicaciones.push({ id: r.id, ...describeMedication(r.description, r.next_dose_at) });
    }
  }
  return out;
}

/** Sustituye la fila optimista por el registro que devolvió la acción, sin releer la lista. */
export function commitHealthRecord(
  state: MappedSaludData,
  profiles: Profile[],
  record: HealthRecord,
  tempId: string,
): MappedSaludData {
  const stripped = removeSaludItem(state, tempId);
  if ((record.type !== "appointment" && record.type !== "medication") || !record.id || !record.patient_id) {
    return stripped;
  }
  const incoming = saludFromHealthRecords([record], profiles);
  const next: MappedSaludData = { ...stripped };
  for (const [key, member] of Object.entries(incoming)) {
    const current = next[key] ?? emptyMember();
    next[key] = {
      citas: member.citas.reduce((list, cita) => upsertById(list, cita), current.citas),
      medicaciones: member.medicaciones.reduce((list, med) => upsertById(list, med), current.medicaciones),
    };
  }
  return next;
}

export function buildCitaHealthInsert(
  patientId: string,
  c: { descripcion: string; fecha: string; hora: string; lugar: string },
): HealthRecordInsert {
  const pid = patientId.trim();
  return {
    patient_id: pid,
    type: "appointment",
    description: JSON.stringify({
      v: 2,
      kind: "cita",
      patient_id: pid,
      descripcion: c.descripcion,
      fecha: c.fecha,
      hora: c.hora,
      lugar: c.lugar ?? "",
    } satisfies KoreCitaPayloadV2),
    date_time: dateTimeFromParts(c.fecha, c.hora),
    next_dose_at: null,
    status: "pending",
  };
}

export function buildMedHealthInsert(
  patientId: string,
  m: { nombre: string; dosis: string; frecuenciaHoras: number; proximaToma: string },
): HealthRecordInsert {
  const pid = patientId.trim();
  return {
    patient_id: pid,
    type: "medication",
    description: JSON.stringify({
      v: 2,
      kind: "med",
      patient_id: pid,
      nombre: m.nombre,
      dosis: m.dosis,
      frecuenciaHoras: m.frecuenciaHoras,
    } satisfies KoreMedPayloadV2),
    date_time: m.proximaToma ? m.proximaToma : null,
    next_dose_at: m.proximaToma || null,
    status: "active",
  };
}

export function buildCitaHealthUpdate(c: {
  patient_id: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
}) {
  const pid = c.patient_id.trim();
  return {
    patient_id: pid,
    description: JSON.stringify({
      v: 2,
      kind: "cita",
      patient_id: pid,
      descripcion: c.descripcion,
      fecha: c.fecha,
      hora: c.hora,
      lugar: c.lugar ?? "",
    } satisfies KoreCitaPayloadV2),
    date_time: dateTimeFromParts(c.fecha, c.hora),
  };
}

export function buildMedHealthUpdate(m: {
  patient_id: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
  proximaToma: string;
}) {
  const pid = m.patient_id.trim();
  return {
    patient_id: pid,
    description: JSON.stringify({
      v: 2,
      kind: "med",
      patient_id: pid,
      nombre: m.nombre,
      dosis: m.dosis,
      frecuenciaHoras: m.frecuenciaHoras,
    } satisfies KoreMedPayloadV2),
    date_time: m.proximaToma ? m.proximaToma : null,
    next_dose_at: m.proximaToma || null,
  };
}

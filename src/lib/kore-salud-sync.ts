import { ANDER_ID, LEIRE_ID, PEQUE_ID, type HealthRecord, type HealthRecordInsert } from "@/lib/kore-db";

export type SaludMember = "Peque" | "Ander" | "Leire";

export type MappedSaludCita = { id: string; descripcion: string; fecha: string; hora: string; lugar: string };
export type MappedSaludMedicacion = {
  id: string;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
  proximaToma: string;
};

/** Misma forma que `SaludData` en `SaludModal` (evita import circular). */
export type MappedSaludData = Record<SaludMember, { citas: MappedSaludCita[]; medicaciones: MappedSaludMedicacion[] }>;

function emptySalud(): MappedSaludData {
  return {
    Peque: { citas: [], medicaciones: [] },
    Ander: { citas: [], medicaciones: [] },
    Leire: { citas: [], medicaciones: [] },
  };
}

export function patientIdForMember(member: SaludMember): string {
  if (member === "Peque") return PEQUE_ID;
  if (member === "Ander") return ANDER_ID;
  return LEIRE_ID;
}

export function memberForPatientId(patientId: string): SaludMember | null {
  if (patientId === PEQUE_ID) return "Peque";
  if (patientId === ANDER_ID) return "Ander";
  if (patientId === LEIRE_ID) return "Leire";
  return null;
}

type KoreCitaPayload = {
  v: 1;
  kind: "cita";
  member: SaludMember;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
};

type KoreMedPayload = {
  v: 1;
  kind: "med";
  member: SaludMember;
  nombre: string;
  dosis: string;
  frecuenciaHoras: number;
};

function parseJsonPayload(description: string): KoreCitaPayload | KoreMedPayload | null {
  try {
    const p = JSON.parse(description) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as { v?: unknown; kind?: unknown };
    if (o.v !== 1) return null;
    if (o.kind === "cita" || o.kind === "med") return p as KoreCitaPayload | KoreMedPayload;
    return null;
  } catch {
    return null;
  }
}

/** Construye `date_time` ISO local-friendly a partir de fecha + hora (YYYY-MM-DD, HH:mm). */
function dateTimeFromParts(fecha: string, hora: string): string {
  const h = (hora ?? "").trim().length >= 5 ? hora.trim() : "00:00";
  return `${fecha}T${h}:00`;
}

export function saludFromHealthRecords(rows: HealthRecord[]): MappedSaludData {
  const out = emptySalud();
  for (const r of rows) {
    const payload = parseJsonPayload(r.description);
    const member = payload?.member ?? memberForPatientId(r.patient_id);
    if (!member) continue;

    if (r.type === "appointment") {
      if (payload && payload.kind === "cita") {
        out[member].citas.push({
          id: r.id,
          descripcion: payload.descripcion,
          fecha: payload.fecha,
          hora: payload.hora,
          lugar: payload.lugar ?? "",
        });
        continue;
      }
      const dt = (r.date_time ?? "").trim();
      const [fecha, rest] = dt.includes("T") ? dt.split("T") : [r.date_time ?? "", ""];
      const hora = rest ? rest.slice(0, 5) : "";
      out[member].citas.push({
        id: r.id,
        descripcion: r.description.slice(0, 200),
        fecha: fecha.slice(0, 10),
        hora,
        lugar: "",
      });
      continue;
    }

    if (r.type === "medication") {
      if (payload && payload.kind === "med") {
        out[member].medicaciones.push({
          id: r.id,
          nombre: payload.nombre,
          dosis: payload.dosis,
          frecuenciaHoras: payload.frecuenciaHoras,
          proximaToma: r.next_dose_at ?? "",
        });
        continue;
      }
      out[member].medicaciones.push({
        id: r.id,
        nombre: r.description.slice(0, 120),
        dosis: "",
        frecuenciaHoras: 0,
        proximaToma: r.next_dose_at ?? "",
      });
    }
  }
  return out;
}

export function buildCitaHealthInsert(
  member: SaludMember,
  c: { descripcion: string; fecha: string; hora: string; lugar: string },
): HealthRecordInsert {
  return {
    patient_id: patientIdForMember(member),
    type: "appointment",
    description: JSON.stringify({
      v: 1,
      kind: "cita",
      member,
      descripcion: c.descripcion,
      fecha: c.fecha,
      hora: c.hora,
      lugar: c.lugar ?? "",
    } satisfies KoreCitaPayload),
    date_time: dateTimeFromParts(c.fecha, c.hora),
    next_dose_at: null,
    status: "pending",
  };
}

export function buildMedHealthInsert(
  member: SaludMember,
  m: { nombre: string; dosis: string; frecuenciaHoras: number; proximaToma: string },
): HealthRecordInsert {
  return {
    patient_id: patientIdForMember(member),
    type: "medication",
    description: JSON.stringify({
      v: 1,
      kind: "med",
      member,
      nombre: m.nombre,
      dosis: m.dosis,
      frecuenciaHoras: m.frecuenciaHoras,
    } satisfies KoreMedPayload),
    date_time: m.proximaToma ? m.proximaToma : null,
    next_dose_at: m.proximaToma || null,
    status: "active",
  };
}

export function buildCitaHealthUpdate(c: { descripcion: string; fecha: string; hora: string; lugar: string; member: SaludMember }) {
  return {
    patient_id: patientIdForMember(c.member),
    description: JSON.stringify({
      v: 1,
      kind: "cita",
      member: c.member,
      descripcion: c.descripcion,
      fecha: c.fecha,
      hora: c.hora,
      lugar: c.lugar ?? "",
    } satisfies KoreCitaPayload),
    date_time: dateTimeFromParts(c.fecha, c.hora),
  };
}

export function buildMedHealthUpdate(
  m: { nombre: string; dosis: string; frecuenciaHoras: number; proximaToma: string; member: SaludMember },
) {
  return {
    patient_id: patientIdForMember(m.member),
    description: JSON.stringify({
      v: 1,
      kind: "med",
      member: m.member,
      nombre: m.nombre,
      dosis: m.dosis,
      frecuenciaHoras: m.frecuenciaHoras,
    } satisfies KoreMedPayload),
    date_time: m.proximaToma ? m.proximaToma : null,
    next_dose_at: m.proximaToma || null,
  };
}

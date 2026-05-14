import { resolveIdByName, resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import type { HealthRecord, HealthRecordInsert, Profile } from "@/lib/kore-db";

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
      const payload = parseJsonPayload(r.description);
      if (payload && payload.kind === "cita") {
        out[memberKey].citas.push({
          id: r.id,
          descripcion: payload.descripcion,
          fecha: payload.fecha,
          hora: payload.hora,
          lugar: "lugar" in payload ? (payload.lugar ?? "") : "",
        });
        continue;
      }
      const dt = (r.date_time ?? "").trim();
      const [fecha, rest] = dt.includes("T") ? dt.split("T") : [r.date_time ?? "", ""];
      const hora = rest ? rest.slice(0, 5) : "";
      out[memberKey].citas.push({
        id: r.id,
        descripcion: (r.description ?? "").slice(0, 200),
        fecha: fecha.slice(0, 10),
        hora,
        lugar: "",
      });
      continue;
    }

    if (r.type === "medication") {
      const payload = parseJsonPayload(r.description);
      if (payload && payload.kind === "med") {
        out[memberKey].medicaciones.push({
          id: r.id,
          nombre: payload.nombre,
          dosis: payload.dosis,
          frecuenciaHoras: payload.frecuenciaHoras,
          proximaToma: r.next_dose_at ?? "",
        });
        continue;
      }
      out[memberKey].medicaciones.push({
        id: r.id,
        nombre: (r.description ?? "").slice(0, 120),
        dosis: "",
        frecuenciaHoras: 0,
        proximaToma: r.next_dose_at ?? "",
      });
    }
  }
  return out;
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

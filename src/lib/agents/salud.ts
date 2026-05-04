import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  addHealthRecord,
  deleteHealthRecord,
  getHealthRecords,
  updateHealthRecord,
} from "@/lib/kore-db";
import {
  buildCitaHealthInsert,
  buildMedHealthInsert,
  memberForPatientId,
  patientIdForMember,
  type SaludMember,
} from "@/lib/kore-salud-sync";

export const AGENT_DESCRIPTION =
  "Experto en salud familiar. Gestiona ÚNICAMENTE citas médicas, medicaciones, dosis, tratamientos y seguimiento de salud de Peque, Ander y Leire.";

const NAMES = new Set([
  "add_appointment",
  "add_medication",
  "log_medication_given",
  "get_health_records",
  "complete_appointment",
  "delete_health_record",
]);

function asMember(p: string): SaludMember | null {
  if (p === "Peque" || p === "Ander" || p === "Leire") return p;
  return null;
}

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_appointment",
      description: "Añade una cita médica.",
      parameters: {
        type: "object",
        properties: {
          patient: { type: "string", enum: ["Peque", "Ander", "Leire"] },
          description: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          location: { type: "string" },
        },
        required: ["patient", "description", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_medication",
      description: "Registra una medicación.",
      parameters: {
        type: "object",
        properties: {
          patient: { type: "string", enum: ["Peque", "Ander", "Leire"] },
          name: { type: "string" },
          dose: { type: "string" },
          frequency_hours: { type: "number" },
          next_dose: { type: "string", description: "ISO o fecha-hora próxima toma" },
        },
        required: ["patient", "name", "dose", "frequency_hours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_medication_given",
      description: "Registra que se administró una medicación.",
      parameters: {
        type: "object",
        properties: {
          patient: { type: "string", enum: ["Peque", "Ander", "Leire"] },
          medication: { type: "string" },
          time: { type: "string" },
        },
        required: ["patient", "medication", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_health_records",
      description: "Lista registros de salud; opcionalmente por paciente.",
      parameters: {
        type: "object",
        properties: {
          patient: { type: "string", enum: ["Peque", "Ander", "Leire"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_appointment",
      description: "Marca una cita como completada.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_health_record",
      description: "Elimina un registro de salud.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Salud." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_appointment": {
      const patient = asMember(String(a.patient ?? ""));
      const descripcion = String(a.description ?? "").trim();
      const fecha = String(a.date ?? "").slice(0, 10);
      const hora = String(a.time ?? "").trim();
      const lugar = String(a.location ?? "").trim();
      if (!patient || !descripcion || !fecha || !hora) return { error: "Faltan campos." };
      const insert = buildCitaHealthInsert(patient, {
        descripcion,
        fecha,
        hora,
        lugar,
      });
      const row = await addHealthRecord(insert);
      return { ok: true, record: row };
    }
    case "add_medication": {
      const patient = asMember(String(a.patient ?? ""));
      const nombre = String(a.name ?? "").trim();
      const dosis = String(a.dose ?? "").trim();
      const frec = Number(a.frequency_hours);
      const nextDose = a.next_dose ? String(a.next_dose) : "";
      if (!patient || !nombre || !dosis || Number.isNaN(frec)) return { error: "Faltan campos." };
      const insert = buildMedHealthInsert(patient, {
        nombre,
        dosis,
        frecuenciaHoras: frec,
        proximaToma: nextDose,
      });
      const row = await addHealthRecord(insert);
      return { ok: true, record: row };
    }
    case "log_medication_given": {
      const patient = asMember(String(a.patient ?? ""));
      const medName = String(a.medication ?? "").trim().toLowerCase();
      const timeNote = String(a.time ?? "").trim();
      if (!patient || !medName) return { error: "Faltan campos." };
      const rows = await getHealthRecords();
      const cand = rows.filter((r) => {
        if (r.type !== "medication") return false;
        const m = memberForPatientId(r.patient_id);
        if (m !== patient) return false;
        try {
          const p = JSON.parse(r.description) as { nombre?: string };
          return (p.nombre ?? r.description).toLowerCase().includes(medName);
        } catch {
          return r.description.toLowerCase().includes(medName);
        }
      });
      const target = cand[0];
      if (!target) return { error: "No se encontró medicación coincidente." };
      const next = new Date(Date.now() + 8 * 3600000).toISOString();
      await updateHealthRecord(target.id, {
        next_dose_at: next,
      });
      return { ok: true, updated_id: target.id, logged_at: timeNote, next_dose_at: next };
    }
    case "get_health_records": {
      const rows = await getHealthRecords();
      const patient = a.patient ? asMember(String(a.patient)) : null;
      if (patient) {
        const pid = patientIdForMember(patient);
        return { ok: true, records: rows.filter((r) => r.patient_id === pid) };
      }
      return { ok: true, records: rows };
    }
    case "complete_appointment": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await updateHealthRecord(id, { status: "completed" });
      return { ok: true, id };
    }
    case "delete_health_record": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteHealthRecord(id);
      return { ok: true, deleted: id };
    }
    default:
      return { error: "Herramienta no reconocida en Salud." };
  }
}

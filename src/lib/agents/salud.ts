import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import {
  addHealthRecord,
  deleteHealthRecord,
  getHealthRecords,
  updateHealthRecord,
} from "@/lib/kore-db";
import {
  buildCitaHealthInsert,
  buildMedHealthInsert,
  resolveHealthBucketPatientId,
} from "@/lib/kore-salud-sync";

export const AGENT_DESCRIPTION =
  "Experto en salud familiar. Gestiona ÚNICAMENTE citas médicas, medicaciones, dosis, tratamientos y seguimiento de salud de los miembros del hogar.";

const NAMES = new Set([
  "add_appointment",
  "add_medication",
  "log_medication_given",
  "get_health_records",
  "complete_appointment",
  "delete_health_record",
]);

function normalizeTime(raw: string): string {
  const s = (raw ?? "").trim();
  const hourOnly = s.match(/^(\d{1,2})$/);
  if (hourOnly) return `${String(Math.min(23, Math.max(0, Number(hourOnly[1])))).padStart(2, "0")}:00`;
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.length === 5 ? s : `0${s}`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "09:00";
}

function normalizeDate(rawDate: string): string | null {
  const input = (rawDate ?? "").trim().toLowerCase();
  if (!input) return null;
  const now = new Date();
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (input === "mañana" || input === "manana") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return toIso(tomorrow);
  }

  if (input === "esta semana") {
    const monday = new Date(now);
    const day = monday.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + mondayOffset);
    return toIso(monday);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const slashOrDash = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashOrDash) {
    const day = Number(slashOrDash[1]);
    const month = Number(slashOrDash[2]);
    let year = Number(slashOrDash[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };
  const textDate = input.match(/^(\d{1,2})(?:\s+de)?\s+([a-záéíóú]+)(?:\s+de)?\s*(\d{4})?$/i);
  if (textDate) {
    const day = Number(textDate[1]);
    const monthName = textDate[2]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const month = months[monthName];
    const year = textDate[3] ? Number(textDate[3]) : 2026;
    if (month && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

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

function resolvePatientId(raw: string, profiles: AgentExecutionContext["profiles"]): string | null {
  return resolveProfileIdFromAgentToken(String(raw ?? "").trim(), profiles);
}

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Salud." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;

  switch (toolName) {
    case "add_appointment": {
      const patientId = resolvePatientId(String(a.patient ?? ""), profiles);
      const descripcion = String(a.description ?? "").trim();
      const rawDate = String(a.date ?? "").trim();
      const fecha = normalizeDate(rawDate);
      const rawTime = String(a.time ?? "").trim();
      const hora = normalizeTime(rawTime);
      const lugar = String(a.location ?? "").trim();
      if (!patientId || !descripcion || !fecha || !hora) return { error: "Faltan campos o paciente no reconocido." };
      const insert = buildCitaHealthInsert(patientId, {
        descripcion,
        fecha,
        hora,
        lugar,
      });
      const row = await addHealthRecord(familyId, insert);
      return { ok: true, record: row };
    }
    case "add_medication": {
      const patientId = resolvePatientId(String(a.patient ?? ""), profiles);
      const nombre = String(a.name ?? "").trim();
      const dosis = String(a.dose ?? "").trim();
      const frec = Number(a.frequency_hours);
      const nextDose = a.next_dose ? String(a.next_dose) : "";
      if (!patientId || !nombre || !dosis || Number.isNaN(frec)) return { error: "Faltan campos o paciente no reconocido." };
      const insert = buildMedHealthInsert(patientId, {
        nombre,
        dosis,
        frecuenciaHoras: frec,
        proximaToma: nextDose,
      });
      const row = await addHealthRecord(familyId, insert);
      return { ok: true, record: row };
    }
    case "log_medication_given": {
      const patientId = resolvePatientId(String(a.patient ?? ""), profiles);
      const medName = String(a.medication ?? "").trim().toLowerCase();
      const timeNote = String(a.time ?? "").trim();
      if (!patientId || !medName) return { error: "Faltan campos o paciente no reconocido." };
      const rows = await getHealthRecords(familyId);
      const cand = rows.filter((r) => {
        if (r.type !== "medication") return false;
        const bucket = resolveHealthBucketPatientId(r, profiles);
        if (bucket !== patientId) return false;
        try {
          const p = JSON.parse(r.description) as { nombre?: string; kind?: string };
          if (p?.kind === "med" && typeof p.nombre === "string") {
            return p.nombre.toLowerCase().includes(medName);
          }
          return (p.nombre ?? r.description).toLowerCase().includes(medName);
        } catch {
          return r.description.toLowerCase().includes(medName);
        }
      });
      const target = cand[0];
      if (!target) return { error: "No se encontró medicación coincidente." };
      const next = new Date(Date.now() + 8 * 3600000).toISOString();
      await updateHealthRecord(familyId, target.id, {
        next_dose_at: next,
      });
      return { ok: true, updated_id: target.id, logged_at: timeNote, next_dose_at: next };
    }
    case "get_health_records": {
      const rows = await getHealthRecords(familyId);
      const filterId = a.patient ? resolvePatientId(String(a.patient), profiles) : null;
      if (filterId) {
        return {
          ok: true,
          records: rows.filter((r) => resolveHealthBucketPatientId(r, profiles) === filterId),
        };
      }
      return { ok: true, records: rows };
    }
    case "complete_appointment": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await updateHealthRecord(familyId, id, { status: "completed" });
      return { ok: true, id };
    }
    case "delete_health_record": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteHealthRecord(familyId, id);
      return { ok: true, deleted: id };
    }
    default:
      return { error: "Herramienta no reconocida en Salud." };
  }
}

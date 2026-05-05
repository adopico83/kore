import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { addLeisureActivity, getLeisureActivities, logPersonalTime } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del tiempo libre y bienestar personal. Gestiona ÚNICAMENTE actividades de ocio, descanso personal, hobbies y tiempo de calidad para cada miembro de la familia.";

const NAMES = new Set([
  "add_leisure_activity",
  "get_leisure_activities",
  "log_personal_time",
  "get_balance_summary",
]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_leisure_activity",
      description: "Registra una actividad de ocio.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", enum: ["Ander", "Leire", "Familia"] },
          activity: { type: "string" },
          date: { type: "string" },
          duration_minutes: { type: "number" },
        },
        required: ["person", "activity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leisure_activities",
      description: "Lista actividades; filtra por persona opcionalmente.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", enum: ["Ander", "Leire", "Familia"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_personal_time",
      description: "Registra tiempo personal de ocio/descanso.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", enum: ["Ander", "Leire"] },
          description: { type: "string" },
          minutes: { type: "number" },
        },
        required: ["person", "description", "minutes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_balance_summary",
      description: "Balance aproximado de minutos registrados entre Ander y Leire.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Tiempo libre." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_leisure_activity": {
      const person = String(a.person ?? "");
      const activity = String(a.activity ?? "").trim();
      if (!person || !activity) throw new Error("Faltan person o activity en tiempo libre.");
      const created = await addLeisureActivity({
        person,
        activity,
        date: a.date ? String(a.date) : undefined,
        duration_minutes: typeof a.duration_minutes === "number" ? Number(a.duration_minutes) : undefined,
      });
      return { ok: true, activity: created };
    }
    case "get_leisure_activities": {
      const person = a.person as string | undefined;
      const activities = await getLeisureActivities(person);
      return { ok: true, activities };
    }
    case "log_personal_time": {
      const person = String(a.person ?? "");
      const description = String(a.description ?? "").trim();
      const minutes = Number(a.minutes);
      if (!person || !description || Number.isNaN(minutes)) throw new Error("Datos inválidos para log_personal_time.");
      const created = await logPersonalTime(person, description, minutes);
      return { ok: true, log: created };
    }
    case "get_balance_summary": {
      const st = await getLeisureActivities();
      let anderM = 0;
      let leireM = 0;
      for (const ac of st) {
        const m = ac.duration_minutes ?? 0;
        if (ac.person === "Ander") anderM += m;
        if (ac.person === "Leire") leireM += m;
      }
      const diff = anderM - leireM;
      return {
        ok: true,
        minutes_ander: anderM,
        minutes_leire: leireM,
        difference_ander_minus_leire: diff,
        interpretation:
          diff === 0
            ? "Equilibrado"
            : diff > 0
              ? "Ander acumula más minutos registrados"
              : "Leire acumula más minutos registrados",
      };
    }
    default:
      return { error: "Herramienta no reconocida en Tiempo libre." };
  }
}

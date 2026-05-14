import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { displayNameForAgentPersonToken, resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import type { Profile } from "@/lib/kore-db";
import { addLeisureActivity, getLeisureActivities, logPersonalTime } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del tiempo libre y bienestar personal. Gestiona ÚNICAMENTE actividades de ocio, descanso personal, hobbies y tiempo de calidad para cada miembro de la familia.";

const NAMES = new Set([
  "add_leisure_activity",
  "get_leisure_activities",
  "log_personal_time",
  "get_balance_summary",
]);

function leisurePersonLabel(raw: string, profiles: Profile[]): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^familia$/i.test(t)) return "Familia";
  return displayNameForAgentPersonToken(t, profiles);
}

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
      description: "Balance aproximado de minutos registrados por persona (según perfiles del hogar).",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Tiempo libre." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;

  switch (toolName) {
    case "add_leisure_activity": {
      const raw = String(a.person ?? "");
      const activity = String(a.activity ?? "").trim();
      if (!raw || !activity) throw new Error("Faltan person o activity en tiempo libre.");
      const person = leisurePersonLabel(raw, profiles);
      const created = await addLeisureActivity(familyId, {
        person,
        activity,
        date: a.date ? String(a.date) : undefined,
        duration_minutes: typeof a.duration_minutes === "number" ? Number(a.duration_minutes) : undefined,
      });
      return { ok: true, activity: created };
    }
    case "get_leisure_activities": {
      const raw = a.person != null && String(a.person).trim() !== "" ? String(a.person) : undefined;
      const person = raw != null ? leisurePersonLabel(raw, profiles) : undefined;
      const activities = await getLeisureActivities(familyId, person);
      return { ok: true, activities };
    }
    case "log_personal_time": {
      const raw = String(a.person ?? "");
      const description = String(a.description ?? "").trim();
      const minutes = Number(a.minutes);
      if (!raw || !description || Number.isNaN(minutes)) throw new Error("Datos inválidos para log_personal_time.");
      const person = leisurePersonLabel(raw, profiles);
      const created = await logPersonalTime(familyId, person, description, minutes);
      return { ok: true, log: created };
    }
    case "get_balance_summary": {
      const st = await getLeisureActivities(familyId);
      const byBucket: Record<string, number> = {};
      for (const ac of st) {
        const m = ac.duration_minutes ?? 0;
        const p = (ac.person ?? "").trim();
        const key =
          /^familia$/i.test(p) ? "Familia" : resolveProfileIdFromAgentToken(p, profiles) ?? p;
        byBucket[key] = (byBucket[key] ?? 0) + m;
      }
      const breakdown = Object.entries(byBucket).map(([key, minutes]) => ({
        key,
        name: key === "Familia" ? "Familia" : profiles.find((pr) => pr.id === key)?.name ?? key,
        minutes,
      }));
      return {
        ok: true,
        breakdown,
        note: "Minutos por persona (histórico mezcla etiquetas antiguas y nombres actuales).",
      };
    }
    default:
      return { error: "Herramienta no reconocida en Tiempo libre." };
  }
}

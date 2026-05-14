import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { displayNameForAgentPersonToken } from "@/lib/family-utils";
import { getNightRecoveryScore, getSleepLogs, logSleepHours, logWakeup } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del sueño y rutinas nocturnas familiares. Gestiona ÚNICAMENTE registros de despertares, horas de sueño, rutinas nocturnas y calidad del descanso.";

const NAMES = new Set(["log_wakeup", "log_sleep_hours", "get_sleep_summary", "get_night_recovery_score"]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_wakeup",
      description: "Registra un despertar nocturno.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", enum: ["Peque", "Ander", "Leire"] },
          reason: { type: "string" },
        },
        required: ["person"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_sleep_hours",
      description: "Registra horas de sueño para una persona (hoy).",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", enum: ["Peque", "Ander", "Leire"] },
          hours: { type: "number" },
        },
        required: ["person", "hours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sleep_summary",
      description: "Resumen de despertares y horas registradas en los últimos N días.",
      parameters: {
        type: "object",
        properties: { days: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_night_recovery_score",
      description: "Lee la puntuación de recuperación nocturna del día (daily_metrics).",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Sueño." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;

  switch (toolName) {
    case "log_wakeup": {
      const raw = String(a.person ?? "").trim();
      if (!raw) throw new Error("Falta person para log_wakeup.");
      const person = displayNameForAgentPersonToken(raw, profiles);
      const row = await logWakeup(familyId, {
        person,
        ...(a.reason ? { reason: String(a.reason) } : {}),
      });
      return { ok: true, log: row };
    }
    case "log_sleep_hours": {
      const raw = String(a.person ?? "").trim();
      const hours = Number(a.hours);
      if (!raw || Number.isNaN(hours)) throw new Error("Datos inválidos para log_sleep_hours.");
      const person = displayNameForAgentPersonToken(raw, profiles);
      const row = await logSleepHours(familyId, person, hours);
      return { ok: true, log: row };
    }
    case "get_sleep_summary": {
      const days = Math.min(30, Math.max(1, Number(a.days) || 7));
      const logs = await getSleepLogs(familyId, days);
      return { ok: true, days, logs };
    }
    case "get_night_recovery_score": {
      const result = await getNightRecoveryScore(familyId);
      return { ok: true, ...result, note: result.night_recovery_score == null ? "Sin métrica para hoy." : undefined };
    }
    default:
      return { error: "Herramienta no reconocida en Sueño." };
  }
}

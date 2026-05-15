import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import {
  addSleepSession,
  getNightRecoveryScore,
  getSleepSessions,
  getSleepSummaryFromSessions,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del sueño y rutinas nocturnas familiares. Gestiona ÚNICAMENTE sesiones de sueño (inicio, fin, despertares) por persona.";

const NAMES = new Set(["log_sleep_session", "get_sleep_sessions", "get_sleep_summary", "get_night_recovery_score"]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_sleep_session",
      description: "Registra una sesión de sueño (noche o siesta) para un familiar.",
      parameters: {
        type: "object",
        properties: {
          person: { type: "string", description: "Nombre del familiar (p. ej. Peque, Ander)" },
          profile_id: { type: "string", description: "UUID de profiles (alternativa a person)" },
          sleep_start: { type: "string", description: "ISO 8601 inicio" },
          sleep_end: { type: "string", description: "ISO 8601 fin" },
          wake_count: { type: "number", description: "Número de despertares" },
          notes: { type: "string" },
        },
        required: ["sleep_start", "sleep_end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sleep_sessions",
      description: "Lista sesiones de sueño recientes.",
      parameters: {
        type: "object",
        properties: { days: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sleep_summary",
      description: "Resumen por persona: media de horas y total de despertares en los últimos N días.",
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

function resolveProfileId(
  a: Record<string, unknown>,
  profiles: AgentExecutionContext["profiles"],
): string {
  const direct = String(a.profile_id ?? "").trim();
  if (direct) return direct;
  const raw = String(a.person ?? "").trim();
  if (!raw) throw new Error("Indica person o profile_id para la sesión de sueño.");
  const id = resolveProfileIdFromAgentToken(raw, profiles);
  if (!id) throw new Error(`No se encontró perfil para "${raw}".`);
  return id;
}

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Sueño." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;

  switch (toolName) {
    case "log_sleep_session": {
      const profile_id = resolveProfileId(a, profiles);
      const sleep_start = String(a.sleep_start ?? "").trim();
      const sleep_end = String(a.sleep_end ?? "").trim();
      if (!sleep_start || !sleep_end) throw new Error("Faltan sleep_start o sleep_end.");
      const row = await addSleepSession(familyId, {
        profile_id,
        sleep_start,
        sleep_end,
        wake_count: Number(a.wake_count) || 0,
        notes: a.notes ? String(a.notes) : null,
      });
      return { ok: true, session: row };
    }
    case "get_sleep_sessions": {
      const days = Math.min(30, Math.max(1, Number(a.days) || 7));
      const sessions = await getSleepSessions(familyId, days);
      return { ok: true, days, sessions };
    }
    case "get_sleep_summary": {
      const days = Math.min(30, Math.max(1, Number(a.days) || 7));
      const summary = await getSleepSummaryFromSessions(familyId, days);
      return { ok: true, ...summary };
    }
    case "get_night_recovery_score": {
      const result = await getNightRecoveryScore(familyId);
      return { ok: true, ...result, note: result.night_recovery_score == null ? "Sin métrica para hoy." : undefined };
    }
    default:
      return { error: "Herramienta no reconocida en Sueño." };
  }
}

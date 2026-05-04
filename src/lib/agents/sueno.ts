import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, getDailyMetrics, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del sueño y rutinas nocturnas familiares. Gestiona ÚNICAMENTE registros de despertares, horas de sueño, rutinas nocturnas y calidad del descanso.";

const LOG_KEY = "kore_subagent_sueno_logs_v1";
const CAT = "sueno";

type WakeupLog = { person: "Peque" | "Ander" | "Leire"; time: string; reason?: string; at: string };
type SleepState = { wakeups: WakeupLog[]; sleepHours: { person: string; hours: number; date: string }[] };

async function loadLogs(): Promise<SleepState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === LOG_KEY);
  if (!row?.value) return { wakeups: [], sleepHours: [] };
  try {
    const p = JSON.parse(row.value) as SleepState;
    return {
      wakeups: Array.isArray(p.wakeups) ? p.wakeups : [],
      sleepHours: Array.isArray(p.sleepHours) ? p.sleepHours : [],
    };
  } catch {
    return { wakeups: [], sleepHours: [] };
  }
}

async function saveLogs(state: SleepState): Promise<void> {
  await upsertAgentMemory(LOG_KEY, JSON.stringify(state), CAT);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
          time: { type: "string", description: "Hora HH:MM" },
          reason: { type: "string" },
        },
        required: ["person", "time"],
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

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Sueño." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "log_wakeup": {
      const person = a.person as WakeupLog["person"];
      const time = String(a.time ?? "").trim();
      if (!person || !time) return { error: "Faltan person o time." };
      const st = await loadLogs();
      const entry: WakeupLog = {
        person,
        time,
        reason: a.reason ? String(a.reason) : undefined,
        at: new Date().toISOString(),
      };
      st.wakeups.push(entry);
      await saveLogs(st);
      return { ok: true, log: entry };
    }
    case "log_sleep_hours": {
      const person = String(a.person ?? "");
      const hours = Number(a.hours);
      if (!person || Number.isNaN(hours)) return { error: "Datos inválidos." };
      const st = await loadLogs();
      const date = todayIso();
      st.sleepHours = st.sleepHours.filter((x) => !(x.person === person && x.date === date));
      st.sleepHours.push({ person, hours, date });
      await saveLogs(st);
      return { ok: true, person, hours, date };
    }
    case "get_sleep_summary": {
      const days = Math.min(30, Math.max(1, Number(a.days) || 7));
      const st = await loadLogs();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const wakeups = st.wakeups.filter((w) => new Date(w.at).getTime() >= cutoff);
      return { ok: true, days, wakeups, sleepHours: st.sleepHours };
    }
    case "get_night_recovery_score": {
      const date = todayIso();
      const m = await getDailyMetrics(date);
      const score = m?.night_recovery_score ?? null;
      return {
        ok: true,
        date,
        night_recovery_score: score,
        note: score == null ? "Sin métrica para hoy en daily_metrics." : undefined,
      };
    }
    default:
      return { error: "Herramienta no reconocida en Sueño." };
  }
}

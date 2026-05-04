import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión del tiempo libre y bienestar personal. Gestiona ÚNICAMENTE actividades de ocio, descanso personal, hobbies y tiempo de calidad para cada miembro de la familia.";

const MEMORY_KEY = "kore_subagent_tiempo_libre_v1";
const CAT = "tiempo_libre";

type LeisureActivity = {
  id: string;
  person: "Ander" | "Leire" | "Familia";
  activity: string;
  date: string | null;
  duration_minutes: number | null;
};

type PersonalLog = { person: string; description: string; minutes: number; at: string };

type TiempoState = { activities: LeisureActivity[]; personal: PersonalLog[] };

async function loadState(): Promise<TiempoState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === MEMORY_KEY);
  if (!row?.value) return { activities: [], personal: [] };
  try {
    const p = JSON.parse(row.value) as TiempoState;
    return {
      activities: Array.isArray(p.activities) ? p.activities : [],
      personal: Array.isArray(p.personal) ? p.personal : [],
    };
  } catch {
    return { activities: [], personal: [] };
  }
}

async function saveState(state: TiempoState): Promise<void> {
  await upsertAgentMemory(MEMORY_KEY, JSON.stringify(state), CAT);
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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
      const person = a.person as LeisureActivity["person"];
      const activity = String(a.activity ?? "").trim();
      if (!person || !activity) return { error: "Faltan campos." };
      const act: LeisureActivity = {
        id: newId(),
        person,
        activity,
        date: a.date ? String(a.date).slice(0, 10) : null,
        duration_minutes: typeof a.duration_minutes === "number" ? a.duration_minutes : null,
      };
      const st = await loadState();
      st.activities.push(act);
      await saveState(st);
      return { ok: true, activity: act };
    }
    case "get_leisure_activities": {
      const st = await loadState();
      const person = a.person as string | undefined;
      const list = person ? st.activities.filter((x) => x.person === person) : st.activities;
      return { ok: true, activities: list };
    }
    case "log_personal_time": {
      const person = String(a.person ?? "");
      const description = String(a.description ?? "").trim();
      const minutes = Number(a.minutes);
      if (!person || !description || Number.isNaN(minutes)) return { error: "Faltan campos." };
      const st = await loadState();
      const log: PersonalLog = {
        person,
        description,
        minutes,
        at: new Date().toISOString(),
      };
      st.personal.push(log);
      await saveState(st);
      return { ok: true, log };
    }
    case "get_balance_summary": {
      const st = await loadState();
      let anderM = 0;
      let leireM = 0;
      for (const p of st.personal) {
        if (p.person === "Ander") anderM += p.minutes;
        if (p.person === "Leire") leireM += p.minutes;
      }
      for (const ac of st.activities) {
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

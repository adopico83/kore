import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión de la limpieza del hogar. Gestiona ÚNICAMENTE tareas de limpieza, frecuencias, zonas del hogar y responsables.";

const MEMORY_KEY = "kore_subagent_limpieza_v1";
const MEMORY_CAT = "limpieza";

type CleaningTask = {
  id: string;
  zone: string;
  task: string;
  frequency: "diaria" | "semanal" | "mensual";
  assigned_to: "Ander" | "Leire";
  completed_at: string | null;
};

type LimpiezaState = { tasks: CleaningTask[] };

async function loadState(): Promise<LimpiezaState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === MEMORY_KEY);
  if (!row?.value) return { tasks: [] };
  try {
    const p = JSON.parse(row.value) as LimpiezaState;
    return { tasks: Array.isArray(p.tasks) ? p.tasks : [] };
  } catch {
    return { tasks: [] };
  }
}

async function saveState(state: LimpiezaState): Promise<void> {
  await upsertAgentMemory(MEMORY_KEY, JSON.stringify(state), MEMORY_CAT);
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `clean_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const NAMES = new Set([
  "add_cleaning_task",
  "get_cleaning_tasks",
  "complete_cleaning_task",
  "get_pending_cleaning",
]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_cleaning_task",
      description: "Registra una tarea de limpieza recurrente.",
      parameters: {
        type: "object",
        properties: {
          zone: { type: "string" },
          task: { type: "string" },
          frequency: { type: "string", enum: ["diaria", "semanal", "mensual"] },
          assigned_to: { type: "string", enum: ["Ander", "Leire"] },
        },
        required: ["zone", "task", "frequency", "assigned_to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cleaning_tasks",
      description: "Lista todas las tareas de limpieza.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_cleaning_task",
      description: "Marca una tarea como hecha ahora.",
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
      name: "get_pending_cleaning",
      description: "Tareas no completadas recientemente (sin completed_at).",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Limpieza." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_cleaning_task": {
      const zone = String(a.zone ?? "").trim();
      const task = String(a.task ?? "").trim();
      const frequency = a.frequency as CleaningTask["frequency"];
      const assigned_to = a.assigned_to as CleaningTask["assigned_to"];
      if (!zone || !task || !frequency || !assigned_to) return { error: "Faltan campos." };
      const t: CleaningTask = {
        id: newId(),
        zone,
        task,
        frequency,
        assigned_to,
        completed_at: null,
      };
      const st = await loadState();
      st.tasks.push(t);
      await saveState(st);
      return { ok: true, task: t };
    }
    case "get_cleaning_tasks": {
      const st = await loadState();
      return { ok: true, tasks: st.tasks };
    }
    case "complete_cleaning_task": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      const st = await loadState();
      const t = st.tasks.find((x) => x.id === id);
      if (!t) return { error: "Tarea no encontrada." };
      t.completed_at = new Date().toISOString();
      await saveState(st);
      return { ok: true, task: t };
    }
    case "get_pending_cleaning": {
      const st = await loadState();
      const pending = st.tasks.filter((t) => !t.completed_at);
      return { ok: true, pending };
    }
    default:
      return { error: "Herramienta no reconocida en Limpieza." };
  }
}

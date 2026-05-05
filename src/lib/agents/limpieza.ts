import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  ANDER_ID,
  addCleaningTask,
  completeCleaningTask,
  getCleaningTasks,
  getPendingCleaningTasks,
  LEIRE_ID,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en gestión de la limpieza del hogar. Gestiona ÚNICAMENTE tareas de limpieza, frecuencias, zonas del hogar y responsables.";

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
      const frequency = String(a.frequency ?? "semanal");
      const assignedRaw = String(a.assigned_to ?? "");
      const assigned_to = assignedRaw === "Ander" ? ANDER_ID : assignedRaw === "Leire" ? LEIRE_ID : undefined;
      if (!zone || !task) throw new Error("Faltan zone o task para limpieza.");
      const created = await addCleaningTask({ zone, task, frequency, assigned_to });
      return { ok: true, task: created };
    }
    case "get_cleaning_tasks": {
      const tasks = await getCleaningTasks();
      return { ok: true, tasks };
    }
    case "complete_cleaning_task": {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("Falta id para completar tarea de limpieza.");
      await completeCleaningTask(id);
      return { ok: true, completed: id };
    }
    case "get_pending_cleaning": {
      const pending = await getPendingCleaningTasks();
      return { ok: true, pending };
    }
    default:
      return { error: "Herramienta no reconocida en Limpieza." };
  }
}

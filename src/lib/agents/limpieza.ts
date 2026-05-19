import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { resolveProfileIdFromAgentToken } from "@/lib/family-utils";
import {
  addCleaningTask,
  completeCleaningTask,
  getCleaningTasks,
  getPendingCleaningTasks,
  getUpcomingCleaningTasks,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

export const AGENT_DESCRIPTION =
  "Experto en gestión de la limpieza del hogar. Gestiona ÚNICAMENTE tareas de limpieza, frecuencias, zonas del hogar y responsables.";

const NAMES = new Set([
  "add_cleaning_task",
  "get_cleaning_tasks",
  "complete_cleaning_task",
  "get_pending_cleaning",
  "get_upcoming_cleaning",
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
          assigned_to: { type: "string", description: "Nombre del adulto responsable" },
        },
        required: ["zone", "task", "frequency", "assigned_to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cleaning_tasks",
      description: "Lista todas las tareas de limpieza con next_due_at y last_completed_at.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_cleaning_task",
      description: "Marca una tarea como hecha ahora y reprograma next_due_at según frequency.",
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
      description: "Tareas vencidas o que tocan hoy (next_due_at <= hoy).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_cleaning",
      description: "Tareas programadas en los próximos días (después de hoy).",
      parameters: {
        type: "object",
        properties: { days: { type: "number", description: "Ventana en días (default 7)" } },
      },
    },
  },
];

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Limpieza." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;
  const admin = createAdminClient();

  switch (toolName) {
    case "add_cleaning_task": {
      const zone = String(a.zone ?? "").trim();
      const task = String(a.task ?? "").trim();
      const frequency = String(a.frequency ?? "semanal");
      const assignedRaw = String(a.assigned_to ?? "");
      const assigned_to = resolveProfileIdFromAgentToken(assignedRaw, profiles) ?? undefined;
      if (!zone || !task) throw new Error("Faltan zone o task para limpieza.");
      const created = await addCleaningTask(admin, familyId, { zone, task, frequency, assigned_to });
      return { ok: true, task: created };
    }
    case "get_cleaning_tasks": {
      const tasks = await getCleaningTasks(admin, familyId);
      return { ok: true, tasks };
    }
    case "complete_cleaning_task": {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("Falta id para completar tarea de limpieza.");
      const updated = await completeCleaningTask(admin, familyId, id);
      return { ok: true, task: updated };
    }
    case "get_pending_cleaning": {
      const pending = await getPendingCleaningTasks(admin, familyId);
      return { ok: true, pending };
    }
    case "get_upcoming_cleaning": {
      const days = Math.min(30, Math.max(1, Number(a.days) || 7));
      const upcoming = await getUpcomingCleaningTasks(admin, familyId, days);
      return { ok: true, days, upcoming };
    }
    default:
      return { error: "Herramienta no reconocida en Limpieza." };
  }
}

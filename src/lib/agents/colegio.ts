import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en todo lo relacionado con el colegio de la hija. Gestiona ÚNICAMENTE excursiones, material escolar, fechas del cole, reuniones de padres, actividades extraescolares.";

const MEMORY_KEY = "kore_subagent_colegio_v1";
const MEMORY_CAT = "colegio";

type SchoolEvent = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  type: "excursion" | "reunion" | "actividad" | "otro";
  description?: string;
};
type SchoolMaterial = { id: string; item: string; urgency: "alta" | "media" | "baja" };

type ColegioState = { events: SchoolEvent[]; materials: SchoolMaterial[] };

async function loadState(): Promise<ColegioState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === MEMORY_KEY);
  if (!row?.value) return { events: [], materials: [] };
  try {
    const p = JSON.parse(row.value) as ColegioState;
    return {
      events: Array.isArray(p.events) ? p.events : [],
      materials: Array.isArray(p.materials) ? p.materials : [],
    };
  } catch {
    return { events: [], materials: [] };
  }
}

async function saveState(state: ColegioState): Promise<void> {
  await upsertAgentMemory(MEMORY_KEY, JSON.stringify(state), MEMORY_CAT);
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const NAMES = new Set([
  "add_school_event",
  "get_school_events",
  "add_school_material",
  "get_school_materials",
  "delete_school_item",
]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_school_event",
      description: "Añade un evento escolar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          type: { type: "string", enum: ["excursion", "reunion", "actividad", "otro"] },
          description: { type: "string" },
        },
        required: ["title", "date", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_school_events",
      description: "Lista todos los eventos escolares guardados.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "add_school_material",
      description: "Añade material escolar pendiente.",
      parameters: {
        type: "object",
        properties: {
          item: { type: "string" },
          urgency: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["item", "urgency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_school_materials",
      description: "Lista el material escolar pendiente.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_school_item",
      description: "Elimina un evento o material por id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          item_type: { type: "string", enum: ["event", "material"] },
        },
        required: ["id", "item_type"],
      },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Colegio." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_school_event": {
      const title = String(a.title ?? "").trim();
      const date = String(a.date ?? "").trim();
      const typ = a.type as SchoolEvent["type"];
      if (!title || !date || !typ) return { error: "Faltan campos obligatorios." };
      const ev: SchoolEvent = {
        id: newId(),
        title,
        date: date.slice(0, 10),
        time: a.time ? String(a.time) : null,
        type: typ,
        description: a.description ? String(a.description) : undefined,
      };
      const st = await loadState();
      st.events.push(ev);
      await saveState(st);
      return { ok: true, event: ev };
    }
    case "get_school_events": {
      const st = await loadState();
      return { ok: true, events: st.events };
    }
    case "add_school_material": {
      const item = String(a.item ?? "").trim();
      const urgency = a.urgency as SchoolMaterial["urgency"];
      if (!item || !urgency) return { error: "Faltan item o urgency." };
      const m: SchoolMaterial = { id: newId(), item, urgency };
      const st = await loadState();
      st.materials.push(m);
      await saveState(st);
      return { ok: true, material: m };
    }
    case "get_school_materials": {
      const st = await loadState();
      return { ok: true, materials: st.materials };
    }
    case "delete_school_item": {
      const id = String(a.id ?? "").trim();
      const item_type = a.item_type as "event" | "material";
      if (!id || !item_type) return { error: "Faltan id o item_type." };
      const st = await loadState();
      if (item_type === "event") st.events = st.events.filter((e) => e.id !== id);
      else st.materials = st.materials.filter((m) => m.id !== id);
      await saveState(st);
      return { ok: true, deleted: id, item_type };
    }
    default:
      return { error: "Herramienta no reconocida en Colegio." };
  }
}

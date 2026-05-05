import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  addSchoolEvent,
  addSchoolMaterial,
  deleteSchoolItem,
  getSchoolEvents,
  getSchoolMaterials,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en todo lo relacionado con el colegio de la hija. Gestiona ÚNICAMENTE excursiones, material escolar, fechas del cole, reuniones de padres, actividades extraescolares.";

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
      const type = String(a.type ?? "otro");
      if (!title || !date) throw new Error("Faltan title o date en evento escolar.");
      const ev = await addSchoolEvent({
        title,
        date,
        time: a.time ? String(a.time) : undefined,
        type,
        description: a.description ? String(a.description) : undefined,
      });
      return { ok: true, event: ev };
    }
    case "get_school_events": {
      const events = await getSchoolEvents();
      return { ok: true, events };
    }
    case "add_school_material": {
      const item = String(a.item ?? "").trim();
      const urgency = String(a.urgency ?? "media");
      if (!item) throw new Error("Falta item en material escolar.");
      const material = await addSchoolMaterial({ item, urgency });
      return { ok: true, material };
    }
    case "get_school_materials": {
      const materials = await getSchoolMaterials();
      return { ok: true, materials };
    }
    case "delete_school_item": {
      const id = String(a.id ?? "").trim();
      const item_type = a.item_type as "event" | "material";
      if (!id || !item_type) throw new Error("Faltan id o item_type para borrar elemento escolar.");
      await deleteSchoolItem(id, item_type);
      return { ok: true, updated: id, item_type };
    }
    default:
      return { error: "Herramienta no reconocida en Colegio." };
  }
}

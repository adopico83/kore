import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  addShoppingItem,
  clearCompletedItems,
  completeShoppingItem,
  deleteShoppingItem,
  getShoppingItems,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en lista de la compra y aprovisionamiento del hogar. Gestiona ÚNICAMENTE items de la lista de la compra, cantidades y prioridades.";

const NAMES = new Set([
  "add_shopping_item",
  "get_shopping_list",
  "complete_shopping_item",
  "delete_shopping_item",
  "clear_completed_items",
]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_shopping_item",
      description: "Añade un producto a la lista de la compra.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          category: { type: "string", enum: ["alimentacion", "limpieza", "higiene", "otro"] },
          priority: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["name", "category", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shopping_list",
      description: "Devuelve la lista de la compra.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_shopping_item",
      description: "Marca un ítem como comprado.",
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
      name: "delete_shopping_item",
      description: "Elimina un ítem de la lista.",
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
      name: "clear_completed_items",
      description: "Elimina de la lista todos los ítems ya completados.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown, familyId: string): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Compras." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_shopping_item": {
      const name = String(a.name ?? "").trim();
      const category = String(a.category ?? "otro");
      const priority = String(a.priority ?? "media");
      if (!name) throw new Error("Falta name para añadir a compras.");
      const item = await addShoppingItem(familyId, {
        name,
        quantity: a.quantity != null ? String(a.quantity) : undefined,
        category,
        priority,
      });
      return { ok: true, item };
    }
    case "get_shopping_list": {
      const items = await getShoppingItems(familyId);
      return { ok: true, items };
    }
    case "complete_shopping_item": {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("Falta id para completar item de compras.");
      await completeShoppingItem(familyId, id);
      return { ok: true, completed: id };
    }
    case "delete_shopping_item": {
      const id = String(a.id ?? "").trim();
      if (!id) throw new Error("Falta id para eliminar item de compras.");
      await deleteShoppingItem(familyId, id);
      return { ok: true, deleted: id };
    }
    case "clear_completed_items": {
      await clearCompletedItems(familyId);
      return { ok: true };
    }
    default:
      return { error: "Herramienta no reconocida en Compras." };
  }
}

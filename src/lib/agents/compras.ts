import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en lista de la compra y aprovisionamiento del hogar. Gestiona ÚNICAMENTE items de la lista de la compra, cantidades y prioridades.";

const MEMORY_KEY = "kore_subagent_compras_v1";
const MEMORY_CAT = "compras";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  category: "alimentacion" | "limpieza" | "higiene" | "otro";
  priority: "alta" | "media" | "baja";
  completed: boolean;
};

type ComprasState = { items: ShoppingItem[] };

async function loadState(): Promise<ComprasState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === MEMORY_KEY);
  if (!row?.value) return { items: [] };
  try {
    const p = JSON.parse(row.value) as ComprasState;
    return { items: Array.isArray(p.items) ? p.items : [] };
  } catch {
    return { items: [] };
  }
}

async function saveState(state: ComprasState): Promise<void> {
  await upsertAgentMemory(MEMORY_KEY, JSON.stringify(state), MEMORY_CAT);
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `shop_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Compras." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_shopping_item": {
      const name = String(a.name ?? "").trim();
      const category = a.category as ShoppingItem["category"];
      const priority = a.priority as ShoppingItem["priority"];
      if (!name || !category || !priority) return { error: "Faltan campos." };
      const item: ShoppingItem = {
        id: newId(),
        name,
        quantity: a.quantity != null ? String(a.quantity) : null,
        category,
        priority,
        completed: false,
      };
      const st = await loadState();
      st.items.push(item);
      await saveState(st);
      return { ok: true, item };
    }
    case "get_shopping_list": {
      const st = await loadState();
      return { ok: true, items: st.items };
    }
    case "complete_shopping_item": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      const st = await loadState();
      const it = st.items.find((x) => x.id === id);
      if (!it) return { error: "Ítem no encontrado." };
      it.completed = true;
      await saveState(st);
      return { ok: true, item: it };
    }
    case "delete_shopping_item": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      const st = await loadState();
      st.items = st.items.filter((x) => x.id !== id);
      await saveState(st);
      return { ok: true, deleted: id };
    }
    case "clear_completed_items": {
      const st = await loadState();
      const before = st.items.length;
      st.items = st.items.filter((x) => !x.completed);
      await saveState(st);
      return { ok: true, removed: before - st.items.length };
    }
    default:
      return { error: "Herramienta no reconocida en Compras." };
  }
}

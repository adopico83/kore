import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en planificación de menús y alimentación familiar. Gestiona ÚNICAMENTE el menú semanal, recetas, ingredientes necesarios.";

const MEMORY_KEY = "kore_subagent_menu_v1";
const MEMORY_CAT = "menu";

type Day =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";
type Meal = "desayuno" | "comida" | "cena";

type MenuSlot = { day: Day; meal: Meal; dish: string };
type MenuState = { slots: MenuSlot[]; history: string[] };

async function loadState(): Promise<MenuState> {
  const rows = await getAgentMemory();
  const row = rows.find((r) => r.key === MEMORY_KEY);
  if (!row?.value) return { slots: [], history: [] };
  try {
    const p = JSON.parse(row.value) as MenuState;
    return {
      slots: Array.isArray(p.slots) ? p.slots : [],
      history: Array.isArray(p.history) ? p.history : [],
    };
  } catch {
    return { slots: [], history: [] };
  }
}

async function saveState(state: MenuState): Promise<void> {
  await upsertAgentMemory(MEMORY_KEY, JSON.stringify(state), MEMORY_CAT);
}

const NAMES = new Set(["add_menu_item", "get_weekly_menu", "clear_day_menu", "suggest_menu"]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_menu_item",
      description: "Añade o actualiza un plato en el menú semanal.",
      parameters: {
        type: "object",
        properties: {
          day: {
            type: "string",
            enum: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
          },
          meal: { type: "string", enum: ["desayuno", "comida", "cena"] },
          dish: { type: "string" },
        },
        required: ["day", "meal", "dish"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weekly_menu",
      description: "Obtiene el menú completo almacenado.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "clear_day_menu",
      description: "Borra todos los platos de un día.",
      parameters: {
        type: "object",
        properties: {
          day: {
            type: "string",
            enum: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
          },
        },
        required: ["day"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_menu",
      description: "Sugiere platos sencillos basándose en el historial de platos usados.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Menú." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_menu_item": {
      const day = a.day as Day;
      const meal = a.meal as Meal;
      const dish = String(a.dish ?? "").trim();
      if (!day || !meal || !dish) return { error: "Faltan campos." };
      const st = await loadState();
      st.slots = st.slots.filter((s) => !(s.day === day && s.meal === meal));
      st.slots.push({ day, meal, dish });
      st.history = [...st.history, dish].slice(-40);
      await saveState(st);
      return { ok: true, slot: { day, meal, dish } };
    }
    case "get_weekly_menu": {
      const st = await loadState();
      return { ok: true, menu: st.slots, historySample: st.history.slice(-10) };
    }
    case "clear_day_menu": {
      const day = a.day as Day;
      if (!day) return { error: "Falta day." };
      const st = await loadState();
      const before = st.slots.length;
      st.slots = st.slots.filter((s) => s.day !== day);
      await saveState(st);
      return { ok: true, removed: before - st.slots.length, day };
    }
    case "suggest_menu": {
      const st = await loadState();
      const pool = [
        "lentejas",
        "pasta con tomate",
        "ensalada + pollo",
        "pescado al horno",
        "tortilla de patata",
        "sopa de verduras",
        "arroz con verduras",
      ];
      const hist = new Set(st.history.map((h) => h.toLowerCase()));
      const pick = pool.filter((p) => !hist.has(p));
      const suggestions = (pick.length ? pick : pool).slice(0, 5);
      return {
        ok: true,
        suggestions,
        note: "Sugerencias heurísticas a partir de platos frecuentes y variación.",
      };
    }
    default:
      return { error: "Herramienta no reconocida en Menú." };
  }
}

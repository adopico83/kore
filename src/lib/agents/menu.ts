import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { addMenuItem, clearDayMenu, getWeeklyMenu } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en planificación de menús y alimentación familiar. Gestiona ÚNICAMENTE el menú semanal, recetas, ingredientes necesarios.";

type Day =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";
type Meal = "desayuno" | "comida" | "cena";

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

export async function execute(toolName: string, args: unknown, familyId: string): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Menú." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_menu_item": {
      const day = a.day as Day;
      const meal = a.meal as Meal;
      const dish = String(a.dish ?? "").trim();
      const week_start = a.week_start ? String(a.week_start) : undefined;
      if (!day || !meal || !dish) throw new Error("Faltan campos para menú.");
      const row = await addMenuItem(familyId, { day, meal, dish, week_start });
      return { ok: true, item: row };
    }
    case "get_weekly_menu": {
      const week_start = a.week_start ? String(a.week_start) : undefined;
      const menu = await getWeeklyMenu(familyId, week_start);
      return { ok: true, menu };
    }
    case "clear_day_menu": {
      const day = a.day as Day;
      const week_start = a.week_start ? String(a.week_start) : undefined;
      if (!day) throw new Error("Falta day para limpiar menú.");
      await clearDayMenu(familyId, day, week_start);
      return { ok: true, day };
    }
    case "suggest_menu": {
      const st = await getWeeklyMenu(familyId);
      const pool = [
        "lentejas",
        "pasta con tomate",
        "ensalada + pollo",
        "pescado al horno",
        "tortilla de patata",
        "sopa de verduras",
        "arroz con verduras",
      ];
      const hist = new Set(st.map((h) => h.dish.toLowerCase()));
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

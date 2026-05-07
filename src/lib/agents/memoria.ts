import type { ChatCompletionTool } from "openai/resources/chat/completions";

import { getAgentMemory, upsertAgentMemory } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en memoria y aprendizaje del hogar. Gestiona ÚNICAMENTE patrones detectados, rutinas aprendidas y sugerencias proactivas basadas en el historial familiar.";

const INSIGHT_PREFIX = "insight:";
const NAMES = new Set(["save_pattern", "get_patterns", "save_insight", "get_relevant_memories"]);

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "save_pattern",
      description: "Guarda un patrón o preferencia en la memoria persistente del agente.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          category: { type: "string", enum: ["rutina", "preferencia", "alerta", "sugerencia"] },
        },
        required: ["key", "value", "category"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_patterns",
      description: "Lista patrones almacenados; filtro opcional por categoría.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["rutina", "preferencia", "alerta", "sugerencia"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_insight",
      description: "Guarda una observación o insight con contexto.",
      parameters: {
        type: "object",
        properties: {
          insight: { type: "string" },
          context: { type: "string" },
        },
        required: ["insight", "context"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_relevant_memories",
      description: "Busca memoria cuyo texto coincida con el contexto dado.",
      parameters: {
        type: "object",
        properties: {
          context: { type: "string" },
        },
        required: ["context"],
      },
    },
  },
];

export async function execute(toolName: string, args: unknown, familyId: string): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Memoria." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "save_pattern": {
      const key = String(a.key ?? "").trim();
      const value = String(a.value ?? "").trim();
      const category = String(a.category ?? "sugerencia");
      if (!key || !value) return { error: "Faltan key o value." };
      await upsertAgentMemory(familyId, key, value, category);
      return { ok: true, key, category };
    }
    case "get_patterns": {
      const rows = await getAgentMemory(familyId);
      const cat = a.category ? String(a.category) : null;
      const filtered = cat ? rows.filter((r) => r.category === cat) : rows;
      return { ok: true, patterns: filtered };
    }
    case "save_insight": {
      const insight = String(a.insight ?? "").trim();
      const context = String(a.context ?? "").trim();
      if (!insight) return { error: "Falta insight." };
      const key = `${INSIGHT_PREFIX}${Date.now()}`;
      const value = JSON.stringify({ insight, context, at: new Date().toISOString() });
      await upsertAgentMemory(familyId, key, value, "sugerencia");
      return { ok: true, key };
    }
    case "get_relevant_memories": {
      const ctx = String(a.context ?? "").trim().toLowerCase();
      if (!ctx) return { error: "Falta context." };
      const rows = await getAgentMemory(familyId);
      const relevant = rows.filter(
        (r) =>
          r.key.toLowerCase().includes(ctx) ||
          r.value.toLowerCase().includes(ctx) ||
          r.category.toLowerCase().includes(ctx),
      );
      return { ok: true, memories: relevant.slice(0, 40) };
    }
    default:
      return { error: "Herramienta no reconocida en Memoria." };
  }
}

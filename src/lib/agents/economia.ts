import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { resolveProfileIdFromAgentToken, sortedAdultsOwnerFirst } from "@/lib/family-utils";
import { addExpense, deleteExpense, getExpenses, type ExpenseInsert, type Profile } from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en economía del hogar. Gestiona ÚNICAMENTE gastos familiares, balance entre miembros adultos, presupuestos y seguimiento financiero.";

const NAMES = new Set([
  "add_expense",
  "get_monthly_summary",
  "get_expenses_list",
  "get_balance",
  "delete_expense",
]);

function payerFrom(s: string, profiles: Profile[]): string | null {
  return resolveProfileIdFromAgentToken(s, profiles);
}

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_expense",
      description: "Registra un gasto.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          category: {
            type: "string",
            enum: ["alimentacion", "hogar", "salud", "ocio", "transporte", "otro"],
          },
          paid_by: { type: "string", enum: ["Ander", "Leire"] },
          is_shared: { type: "boolean" },
        },
        required: ["description", "amount", "category", "paid_by", "is_shared"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_monthly_summary",
      description: "Totales del mes actual por categoría.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_expenses_list",
      description: "Lista gastos recientes.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_balance",
      description: "Balance compartido: cuánto aportó cada adulto frente a la parte equitativa del gasto compartido.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_expense",
      description: "Elimina un gasto por id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
];

function monthWindow() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Economía." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  const { familyId, profiles } = ctx;

  switch (toolName) {
    case "add_expense": {
      const description = String(a.description ?? "").trim();
      const amount = Number(a.amount);
      const category = String(a.category ?? "otro");
      const paidBy = payerFrom(String(a.paid_by ?? ""), profiles);
      const is_shared = Boolean(a.is_shared);
      if (!description || Number.isNaN(amount) || amount <= 0 || !paidBy) {
        return { error: "Datos de gasto inválidos." };
      }
      const insert: ExpenseInsert = {
        payer_id: paidBy,
        amount: Math.abs(amount),
        category,
        description,
        is_shared,
        source: "manual",
      };
      const row = await addExpense(familyId, insert);
      return { ok: true, expense: row };
    }
    case "get_monthly_summary": {
      const { start, end } = monthWindow();
      const rows = await getExpenses(familyId);
      const inMonth = rows.filter((r) => {
        const t = new Date(r.created_at ?? "").getTime();
        return t >= start.getTime() && t <= end.getTime();
      });
      const byCat: Record<string, number> = {};
      let total = 0;
      for (const r of inMonth) {
        total += Math.abs(r.amount);
        byCat[r.category] = (byCat[r.category] ?? 0) + Math.abs(r.amount);
      }
      return { ok: true, total_month: total, by_category: byCat, count: inMonth.length };
    }
    case "get_expenses_list": {
      const limit = Math.min(100, Math.max(1, Number(a.limit) || 30));
      const rows = await getExpenses(familyId);
      return { ok: true, expenses: rows.slice(0, limit) };
    }
    case "get_balance": {
      const rows = await getExpenses(familyId);
      const shared = rows.filter((r) => r.is_shared);
      const totalShared = shared.reduce((acc, r) => acc + Math.abs(r.amount), 0);
      const adults = sortedAdultsOwnerFirst(profiles);
      const n = Math.max(1, adults.length);
      const fairShare = totalShared / n;
      const breakdown = adults.map((adult) => {
        const paid = shared.filter((r) => r.payer_id === adult.id).reduce((acc, r) => acc + Math.abs(r.amount), 0);
        return {
          profile_id: adult.id,
          name: adult.name,
          paid,
          balance_due: Math.max(0, fairShare - paid),
        };
      });
      return {
        ok: true,
        total_shared: totalShared,
        fair_share_per_adult: fairShare,
        adults: breakdown,
      };
    }
    case "delete_expense": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteExpense(familyId, id);
      return { ok: true, deleted: id };
    }
    default:
      return { error: "Herramienta no reconocida en Economía." };
  }
}

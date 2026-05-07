import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  addExpense,
  ANDER_ID,
  deleteExpense,
  getExpenses,
  LEIRE_ID,
  type ExpenseInsert,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en economía del hogar. Gestiona ÚNICAMENTE gastos familiares, balance entre Ander y Leire, presupuestos y seguimiento financiero.";

const NAMES = new Set([
  "add_expense",
  "get_monthly_summary",
  "get_expenses_list",
  "get_balance",
  "delete_expense",
]);

function payerFrom(s: string): string | null {
  if (s === "Ander") return ANDER_ID;
  if (s === "Leire") return LEIRE_ID;
  return null;
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
      description: "Balance compartido: cuánto debe cada uno respecto al reparto al 50%.",
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

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Economía." };
  }
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  switch (toolName) {
    case "add_expense": {
      const description = String(a.description ?? "").trim();
      const amount = Number(a.amount);
      const category = String(a.category ?? "otro");
      const paidBy = payerFrom(String(a.paid_by ?? ""));
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
      const row = await addExpense(insert);
      return { ok: true, expense: row };
    }
    case "get_monthly_summary": {
      const { start, end } = monthWindow();
      const rows = await getExpenses();
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
      const rows = await getExpenses();
      return { ok: true, expenses: rows.slice(0, limit) };
    }
    case "get_balance": {
      const rows = await getExpenses();
      const shared = rows.filter((r) => r.is_shared);
      const totalShared = shared.reduce((acc, r) => acc + Math.abs(r.amount), 0);
      const paidAnder = shared
        .filter((r) => r.payer_id === ANDER_ID)
        .reduce((acc, r) => acc + Math.abs(r.amount), 0);
      const paidLeire = shared
        .filter((r) => r.payer_id === LEIRE_ID)
        .reduce((acc, r) => acc + Math.abs(r.amount), 0);
      const half = totalShared / 2;
      return {
        ok: true,
        total_shared: totalShared,
        debe_ander: Math.max(0, half - paidAnder),
        debe_leire: Math.max(0, half - paidLeire),
        paid_ander: paidAnder,
        paid_leire: paidLeire,
      };
    }
    case "delete_expense": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteExpense(id);
      return { ok: true, deleted: id };
    }
    default:
      return { error: "Herramienta no reconocida en Economía." };
  }
}

import type { ChatCompletionTool } from "openai/resources/chat/completions";

import type { AgentExecutionContext } from "./agent-execution-context";
import { sortedAdultsOwnerFirst } from "@/lib/family-utils";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  type CalendarEventInsert,
} from "@/lib/kore-db";

export const AGENT_DESCRIPTION =
  "Experto en calendario familiar. Gestiona ÚNICAMENTE eventos, citas familiares generales, fechas importantes y recordatorios del calendario.";

const NAMES = new Set([
  "add_calendar_event",
  "get_calendar_events",
  "delete_calendar_event",
  "get_upcoming_events",
]);

function outOfTool(): { error: string } {
  return { error: "Esta herramienta no corresponde al subagente de Agenda." };
}

function parseArgs(args: unknown): Record<string, unknown> {
  return args && typeof args === "object" ? (args as Record<string, unknown>) : {};
}

export const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_calendar_event",
      description: "Crea un evento en el calendario familiar.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del evento" },
          date: { type: "string", description: "Fecha YYYY-MM-DD" },
          time: { type: "string", description: "Hora HH:MM" },
          description: { type: "string", description: "Detalle opcional (se añade al título)" },
        },
        required: ["title", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Lista eventos del calendario en un rango de fechas opcional.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string" },
          to_date: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Elimina un evento por id.",
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
      name: "get_upcoming_events",
      description: "Próximos eventos en los siguientes N días (por defecto 14).",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de días hacia adelante" },
        },
      },
    },
  },
];

function normalizeTime(t: string): string {
  const s = (t ?? "").trim();
  const hourOnly = s.match(/^(\d{1,2})$/);
  if (hourOnly) return `${String(Math.min(23, Math.max(0, Number(hourOnly[1])))).padStart(2, "0")}:00`;
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.length === 5 ? s : `0${s}`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "09:00";
}

function normalizeDate(rawDate: string): string | null {
  const input = (rawDate ?? "").trim().toLowerCase();
  if (!input) return null;
  const now = new Date();
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (input === "mañana" || input === "manana") {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const normalized = toIso(tomorrow);
    console.log("[agenda] normalizeDate", { rawDate, normalized, mode: "relative_tomorrow" });
    return normalized;
  }

  if (input === "esta semana") {
    const monday = new Date(now);
    const day = monday.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + mondayOffset);
    const normalized = toIso(monday);
    console.log("[agenda] normalizeDate", { rawDate, normalized, mode: "relative_week_monday" });
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    console.log("[agenda] normalizeDate", { rawDate, normalized: input, mode: "iso" });
    return input;
  }

  const slashOrDash = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashOrDash) {
    const day = Number(slashOrDash[1]);
    const month = Number(slashOrDash[2]);
    let year = Number(slashOrDash[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      console.log("[agenda] normalizeDate", { rawDate, normalized, mode: "slash_or_dash" });
      return normalized;
    }
  }

  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };

  const textDate = input.match(/^(\d{1,2})(?:\s+de)?\s+([a-záéíóú]+)(?:\s+de)?\s*(\d{4})?$/i);
  if (textDate) {
    const day = Number(textDate[1]);
    const monthName = textDate[2]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const month = months[monthName];
    const year = textDate[3] ? Number(textDate[3]) : 2026;
    if (month && day >= 1 && day <= 31) {
      const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      console.log("[agenda] normalizeDate", { rawDate, normalized, mode: "text_month" });
      return normalized;
    }
  }

  console.log("[agenda] normalizeDate", { rawDate, normalized: null, mode: "failed" });
  return null;
}

export async function execute(toolName: string, args: unknown, ctx: AgentExecutionContext): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Agenda." };
  }
  const a = parseArgs(args);

  switch (toolName) {
    case "add_calendar_event": {
      const title = String(a.title ?? "").trim();
      const rawDate = String(a.date ?? "").trim();
      const date = normalizeDate(rawDate);
      const time = normalizeTime(String(a.time ?? ""));
      const extra = String(a.description ?? "").trim();
      if (!title || !date) return { error: "Faltan title o date." };
      const fullTitle = extra ? `${title} — ${extra}` : title;
      const explicitCreatedBy =
        typeof a.created_by === "string" && String(a.created_by).trim() ? String(a.created_by).trim() : "";
      const defaultCreatedBy =
        ctx.currentUserId?.trim() || sortedAdultsOwnerFirst(ctx.profiles)[0]?.id || null;
      const row: CalendarEventInsert = {
        title: fullTitle,
        date: date.slice(0, 10),
        time,
        created_by: explicitCreatedBy || defaultCreatedBy,
      };
      console.log("[agenda] add_calendar_event input", {
        rawArgs: a,
        title,
        rawDate,
        normalizedDate: date,
        time,
        createdBy: row.created_by,
      });
      const created = await addCalendarEvent(ctx.familyId, row);
      console.log("[agenda] add_calendar_event output", created);
      return { ok: true, event: created };
    }
    case "get_calendar_events": {
      const from = (a.from_date as string | undefined)?.slice(0, 10);
      const to = (a.to_date as string | undefined)?.slice(0, 10);
      let rows = await getCalendarEvents(ctx.familyId);
      if (from) rows = rows.filter((r) => r.date >= from);
      if (to) rows = rows.filter((r) => r.date <= to);
      return { ok: true, events: rows };
    }
    case "delete_calendar_event": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteCalendarEvent(ctx.familyId, id);
      return { ok: true, deleted: id };
    }
    case "get_upcoming_events": {
      const days = Math.min(90, Math.max(1, Number(a.days) || 14));
      const today = new Date();
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const end = new Date(today);
      end.setDate(end.getDate() + days);
      const fromStr = iso(today);
      const toStr = iso(end);
      const rows = await getCalendarEvents(ctx.familyId);
      const filtered = rows.filter((r) => r.date >= fromStr && r.date <= toStr);
      return { ok: true, days, events: filtered };
    }
    default:
      return outOfTool();
  }
}

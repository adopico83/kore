import type { ChatCompletionTool } from "openai/resources/chat/completions";

import {
  addCalendarEvent,
  ANDER_ID,
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
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.length === 5 ? s : `0${s}`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "09:00";
}

export async function execute(toolName: string, args: unknown): Promise<unknown> {
  if (!NAMES.has(toolName)) {
    return { error: "Esta petición no es competencia del subagente de Agenda." };
  }
  const a = parseArgs(args);

  switch (toolName) {
    case "add_calendar_event": {
      const title = String(a.title ?? "").trim();
      const date = String(a.date ?? "").trim();
      const time = normalizeTime(String(a.time ?? ""));
      const extra = String(a.description ?? "").trim();
      if (!title || !date) return { error: "Faltan title o date." };
      const fullTitle = extra ? `${title} — ${extra}` : title;
      const row: CalendarEventInsert = {
        title: fullTitle,
        date: date.slice(0, 10),
        time,
        created_by: ANDER_ID,
      };
      const created = await addCalendarEvent(row);
      return { ok: true, event: created };
    }
    case "get_calendar_events": {
      const from = (a.from_date as string | undefined)?.slice(0, 10);
      const to = (a.to_date as string | undefined)?.slice(0, 10);
      let rows = await getCalendarEvents();
      if (from) rows = rows.filter((r) => r.date >= from);
      if (to) rows = rows.filter((r) => r.date <= to);
      return { ok: true, events: rows };
    }
    case "delete_calendar_event": {
      const id = String(a.id ?? "").trim();
      if (!id) return { error: "Falta id." };
      await deleteCalendarEvent(id);
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
      const rows = await getCalendarEvents();
      const filtered = rows.filter((r) => r.date >= fromStr && r.date <= toStr);
      return { ok: true, days, events: filtered };
    }
    default:
      return outOfTool();
  }
}

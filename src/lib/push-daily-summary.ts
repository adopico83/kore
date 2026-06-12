import OpenAI from "openai";

import { addDays, formatDateIso, todayIsoDate } from "@/lib/cleaning-schedule";
import {
  getCalendarEventsOnDate,
  getFamilyNameById,
  getHealthRecordsForDailySummary,
  getPendingCleaningTasks,
  getProfilesForFamily,
  type CalendarEventRow,
  type CleaningTaskRow,
  type KoreServerDbClient,
} from "@/lib/kore-db";

export type DailySummaryHealthItem = {
  kind: "appointment" | "medication";
  patientName: string;
  description: string;
  whenLabel: string;
};

export type DailySummaryContext = {
  familyId: string;
  familyName: string;
  todayIso: string;
  tomorrowIso: string;
  cleaningTasks: CleaningTaskRow[];
  tomorrowEvents: CalendarEventRow[];
  healthItems: DailySummaryHealthItem[];
};

function timeLabel(raw: string | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return t.includes("T") ? (t.split("T")[1]?.slice(0, 5) ?? t) : t.slice(0, 5);
}

function mapHealthItems(
  records: Awaited<ReturnType<typeof getHealthRecordsForDailySummary>>,
  nameFor: (id: string) => string,
): DailySummaryHealthItem[] {
  return records.map((r) => {
    if (r.type === "appointment") {
      return {
        kind: "appointment" as const,
        patientName: nameFor(r.patient_id),
        description: r.description,
        whenLabel: timeLabel(r.date_time) || "mañana",
      };
    }
    return {
      kind: "medication" as const,
      patientName: nameFor(r.patient_id),
      description: r.description,
      whenLabel: timeLabel(r.next_dose_at) || "pendiente",
    };
  });
}

export function hasRelevantDailySummary(ctx: DailySummaryContext): boolean {
  return ctx.cleaningTasks.length > 0 || ctx.tomorrowEvents.length > 0 || ctx.healthItems.length > 0;
}

export async function fetchDailySummaryContext(
  admin: KoreServerDbClient,
  familyId: string,
  now = new Date(),
): Promise<DailySummaryContext> {
  const todayIso = todayIsoDate(now);
  const tomorrowIso = formatDateIso(addDays(new Date(`${todayIso}T12:00:00`), 1));

  const [familyName, profiles, cleaningTasks, tomorrowEvents, healthRecords] = await Promise.all([
    getFamilyNameById(admin, familyId),
    getProfilesForFamily(admin, familyId),
    getPendingCleaningTasks(admin, familyId, todayIso),
    getCalendarEventsOnDate(admin, familyId, tomorrowIso),
    getHealthRecordsForDailySummary(admin, familyId, todayIso, tomorrowIso),
  ]);

  const nameFor = (id: string) => profiles.find((p) => p.id === id)?.name ?? "Alguien";

  return {
    familyId,
    familyName,
    todayIso,
    tomorrowIso,
    cleaningTasks,
    tomorrowEvents,
    healthItems: mapHealthItems(healthRecords, nameFor),
  };
}

/** Resumen determinista si GPT no está disponible o falla. */
export function buildFallbackDailySummaryMessage(ctx: DailySummaryContext): string {
  const parts: string[] = [`Buenos días, ${ctx.familyName}.`];

  if (ctx.cleaningTasks.length > 0) {
    const sample = ctx.cleaningTasks
      .slice(0, 3)
      .map((t) => `${t.zone}: ${t.task}`)
      .join("; ");
    const extra = ctx.cleaningTasks.length > 3 ? ` (+${ctx.cleaningTasks.length - 3} más)` : "";
    parts.push(`Limpieza hoy: ${sample}${extra}.`);
  }

  if (ctx.tomorrowEvents.length > 0) {
    const sample = ctx.tomorrowEvents
      .slice(0, 3)
      .map((e) => {
        const h = e.time?.trim() ? ` ${e.time.slice(0, 5)}` : "";
        return `${e.title}${h}`;
      })
      .join("; ");
    parts.push(`Mañana en agenda: ${sample}.`);
  }

  if (ctx.healthItems.length > 0) {
    const sample = ctx.healthItems
      .slice(0, 3)
      .map((h) =>
        h.kind === "appointment"
          ? `cita de ${h.patientName} (${h.description})`
          : `medicación de ${h.patientName} (${h.description})`,
      )
      .join("; ");
    parts.push(`Salud: ${sample}.`);
  }

  return parts.join(" ");
}

function buildGptPayload(ctx: DailySummaryContext): string {
  return JSON.stringify(
    {
      familia: ctx.familyName,
      hoy: ctx.todayIso,
      manana: ctx.tomorrowIso,
      limpieza_hoy: ctx.cleaningTasks.map((t) => ({
        zona: t.zone,
        tarea: t.task,
        frecuencia: t.frequency,
      })),
      agenda_manana: ctx.tomorrowEvents.map((e) => ({
        titulo: e.title,
        hora: e.time?.trim() ? e.time.slice(0, 5) : null,
      })),
      salud: ctx.healthItems.map((h) => ({
        tipo: h.kind,
        persona: h.patientName,
        detalle: h.description,
        cuando: h.whenLabel,
      })),
    },
    null,
    0,
  );
}

export async function generateDailySummaryMessage(ctx: DailySummaryContext): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return buildFallbackDailySummaryMessage(ctx);

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 180,
    messages: [
      {
        role: "system",
        content:
          "Eres Kore, asistente familiar. Redactas un único mensaje de notificación push matinal en español. " +
          "Máximo 100 palabras. Tono cálido, cercano y útil. Sin emojis. Sin markdown. Sin saludo genérico vacío: ve al grano.",
      },
      {
        role: "user",
        content:
          "Genera el texto del cuerpo de la notificación con estos datos (JSON). " +
          "Prioriza lo más urgente. Si hay limpieza vencida, menciónala. Si hay citas mañana, recuérdalas con hora.\n\n" +
          buildGptPayload(ctx),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) return buildFallbackDailySummaryMessage(ctx);
  return text;
}

/** Frecuencias de limpieza soportadas en DB y agente. */
export type CleaningFrequency = "diaria" | "semanal" | "mensual";

const FREQUENCY_ALIASES: Record<string, CleaningFrequency> = {
  diaria: "diaria",
  daily: "diaria",
  semanal: "semanal",
  weekly: "semanal",
  mensual: "mensual",
  monthly: "mensual",
};

export function normalizeCleaningFrequency(raw: string | null | undefined): CleaningFrequency {
  const key = (raw ?? "semanal").trim().toLowerCase();
  return FREQUENCY_ALIASES[key] ?? "semanal";
}

export function formatDateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIsoDate(now = new Date()): string {
  return formatDateIso(now);
}

/** Suma días calendario a una fecha (sin mutar el argumento). */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Calcula la próxima fecha de vencimiento según frecuencia. */
export function computeNextDueDate(from: Date, frequencyRaw: string | null | undefined): Date {
  const frequency = normalizeCleaningFrequency(frequencyRaw);
  if (frequency === "diaria") return addDays(from, 1);
  if (frequency === "mensual") return addDays(from, 30);
  return addDays(from, 7);
}

export function computeInitialNextDueDate(
  createdAt: Date,
  frequencyRaw: string | null | undefined,
): string {
  return formatDateIso(computeNextDueDate(createdAt, frequencyRaw));
}

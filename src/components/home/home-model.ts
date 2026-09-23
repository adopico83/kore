export type HomeTab = "inicio" | "casa" | "corcho" | "yo";

export type AgendaSource = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
};

export type AgendaRow = {
  id: string;
  time: string;
  title: string;
  highlight: boolean;
};

export type PendingKind = "shopping" | "cleaning" | "corcho";

export type PendingRow = {
  id: string;
  kind: PendingKind;
  title: string;
  subtitle: string;
};

export type PendingShopping = {
  id: string;
  name: string;
  completed: boolean;
};

export type PendingCleaning = {
  id: string;
  zone: string;
  task: string;
  completed: boolean;
};

export type PendingNote = {
  id: string;
  title: string;
  subtitle: string;
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const RING_AMBER = "#EF9F27";
const RING_TEAL = "#4CC9A0";
const RING_FALLBACK = ["#9B8FE8", "#E05555"] as const;

const PHOTO_NOTE = /^📎\s*(?:\d+\s+)?im[aá]gen(?:es)?$/i;

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function greetingFor(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? `Buenas, ${first}` : "Buenas";
}

export function formatHomeDate(date: Date): { long: string; short: string } {
  const weekday = WEEKDAYS[date.getDay()] ?? "";
  const month = MONTHS[date.getMonth()] ?? "";
  return {
    long: `${weekday} ${date.getDate()} · ${month}`,
    short: `${weekday} ${date.getDate()}`,
  };
}

/** Anillo de identidad: A ámbar, L teal. El resto rota lavanda / rojo. */
export function avatarRingFor(name: string, index = 0): string {
  const initial = name.trim().charAt(0).toLocaleUpperCase("es");
  if (initial === "A") return RING_AMBER;
  if (initial === "L") return RING_TEAL;
  return RING_FALLBACK[index % RING_FALLBACK.length] ?? RING_FALLBACK[0];
}

export function buildTodayAgenda(events: AgendaSource[], now = new Date()): AgendaRow[] {
  const iso = toIsoDate(now);
  return events
    .filter((event) => (event.fecha ?? "").slice(0, 10) === iso)
    .slice()
    .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? "") || a.titulo.localeCompare(b.titulo, "es"))
    .map((event, index) => {
      const time = (event.hora ?? "").trim().slice(0, 5);
      return {
        id: event.id,
        time: time || "—",
        title: event.titulo,
        highlight: index === 0,
      };
    });
}

export function buildPendingRows(input: {
  shopping: PendingShopping[];
  cleaning: PendingCleaning[];
  note?: PendingNote | null;
}): { mobile: PendingRow[]; desktop: PendingRow[] } {
  const tasks: PendingRow[] = [];

  for (const item of input.shopping) {
    if (item.completed) continue;
    const title = item.name.trim();
    if (!title) continue;
    tasks.push({ id: item.id, kind: "shopping", title, subtitle: "Compras" });
  }

  for (const task of input.cleaning) {
    if (task.completed) continue;
    const zone = task.zone.trim();
    const label = task.task.trim();
    const title = zone || label;
    if (!title) continue;
    tasks.push({ id: task.id, kind: "cleaning", title, subtitle: "Limpieza" });
  }

  const note = input.note?.title.trim()
    ? {
        id: input.note.id,
        kind: "corcho" as const,
        title: input.note.title.trim(),
        subtitle: input.note.subtitle.trim() || "Corcho",
      }
    : null;

  return {
    mobile: mixPending(tasks, 3),
    desktop: note ? [...mixPending(tasks, 2), note] : mixPending(tasks, 3),
  };
}

function mixPending(tasks: PendingRow[], limit: number): PendingRow[] {
  const shopping = tasks.filter((row) => row.kind === "shopping");
  const cleaning = tasks.filter((row) => row.kind === "cleaning");
  const mixed: PendingRow[] = [];
  let shoppingIndex = 0;
  let cleaningIndex = 0;
  while (mixed.length < limit && (shoppingIndex < shopping.length || cleaningIndex < cleaning.length)) {
    const nextShopping = shopping[shoppingIndex];
    if (nextShopping) {
      mixed.push(nextShopping);
      shoppingIndex += 1;
    }
    const nextCleaning = cleaning[cleaningIndex];
    if (mixed.length < limit && nextCleaning) {
      mixed.push(nextCleaning);
      cleaningIndex += 1;
    }
  }
  return mixed;
}

/** El corcho solo persiste texto. Las notas que fingían una foto se leen como tal. */
export function honestCorchoText(content: string): string {
  const trimmed = content.trim();
  if (PHOTO_NOTE.test(trimmed)) return "Había una foto adjunta; no se guardó.";
  return content;
}

import type { CalendarEventRow, HealthRecord, KoreNote, ShoppingItemRow } from "@/lib/kore-db";

/**
 * Reducers puros para actualización optimista y para mezclar filas de Realtime por id.
 * La UI pinta el cambio al momento; cuando llega la fila del servidor (o el evento
 * de la misma escritura) se reconcilia por id, sin volver a pedir la lista.
 */

export type IdRow = { id: string };

export type ListMutation<T extends IdRow> =
  | { type: "add"; item: T }
  | { type: "patch"; id: string; patch: Partial<T> }
  | { type: "remove"; id: string };

export function applyListMutation<T extends IdRow>(rows: T[], mutation: ListMutation<T>): T[] {
  switch (mutation.type) {
    case "add": {
      if (rows.some((row) => row.id === mutation.item.id)) return rows;
      return [mutation.item, ...rows];
    }
    case "patch":
      return rows.map((row) => (row.id === mutation.id ? { ...row, ...mutation.patch } : row));
    case "remove":
      return rows.filter((row) => row.id !== mutation.id);
  }
}

/** Inserta o sustituye por id. `start` deja las filas nuevas al principio (listas por fecha descendente). */
export function upsertById<T extends IdRow>(rows: T[], item: T, position: "start" | "keep" = "keep"): T[] {
  const index = rows.findIndex((row) => row.id === item.id);
  if (index === -1) return position === "start" ? [item, ...rows] : [...rows, item];
  const next = rows.slice();
  next[index] = item;
  return next;
}

export type RemoteRowChange<T extends IdRow> = {
  event: string;
  id: string | null;
  row: T | null;
};

/**
 * Mezcla un cambio remoto. Devuelve null si falta la fila o el id y hace falta
 * una lectura dirigida (el llamador la agrupa en un solo fetch).
 * Una escritura propia que ya está en la lista con el mismo id no se duplica.
 */
export function mergeRemoteRow<T extends IdRow>(
  rows: T[],
  change: RemoteRowChange<T>,
  insertPosition: "start" | "keep" = "keep",
): T[] | null {
  if (change.event === "DELETE") {
    if (!change.id) return null;
    return rows.filter((row) => row.id !== change.id);
  }
  if (change.event !== "INSERT" && change.event !== "UPDATE") return null;
  if (!change.row) return null;
  return upsertById(rows, change.row, change.event === "INSERT" ? insertPosition : "keep");
}

export type SaludBuckets<C extends IdRow, M extends IdRow> = Record<string, { citas: C[]; medicaciones: M[] }>;

export type SaludListAction<C extends IdRow, M extends IdRow> =
  | { type: "add-cita"; memberId: string; cita: C }
  | { type: "add-med"; memberId: string; med: M };

export function applySaludAction<C extends IdRow, M extends IdRow>(
  state: SaludBuckets<C, M>,
  action: SaludListAction<C, M>,
): SaludBuckets<C, M> {
  const member = state[action.memberId] ?? { citas: [] as C[], medicaciones: [] as M[] };
  if (action.type === "add-cita") {
    if (member.citas.some((cita) => cita.id === action.cita.id)) return state;
    return {
      ...state,
      [action.memberId]: { ...member, citas: [...member.citas, action.cita] },
    };
  }
  if (member.medicaciones.some((med) => med.id === action.med.id)) return state;
  return {
    ...state,
    [action.memberId]: { ...member, medicaciones: [...member.medicaciones, action.med] },
  };
}

export function removeSaludItem<T extends { citas: IdRow[]; medicaciones: IdRow[] }>(
  state: Record<string, T>,
  id: string,
): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, member] of Object.entries(state)) {
    next[key] = {
      ...member,
      citas: member.citas.filter((item) => item.id !== id),
      medicaciones: member.medicaciones.filter((item) => item.id !== id),
    };
  }
  return next;
}

/** Al confirmar un mensaje, conserva las fotos que el evento remoto todavía no trae. */
export function mergeCorchoMessage<T extends IdRow & { imageUrls: string[]; pending?: boolean }>(
  messages: T[],
  incoming: T,
): T[] {
  const index = messages.findIndex((message) => message.id === incoming.id);
  if (index === -1) return [...messages, { ...incoming, pending: false }];
  const current = messages[index]!;
  const imageUrls = incoming.imageUrls.length > 0 ? incoming.imageUrls : current.imageUrls;
  const next = messages.slice();
  next[index] = { ...incoming, imageUrls, pending: false };
  return next;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function readShoppingItem(value: unknown): ShoppingItemRow | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    quantity: text(row.quantity),
    category: text(row.category),
    priority: text(row.priority),
    completed: row.completed === true,
    created_by: text(row.created_by),
    created_at: text(row.created_at) ?? "",
  };
}

export function readCalendarEvent(value: unknown): CalendarEventRow | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.title !== "string") return null;
  return {
    id: row.id,
    title: row.title,
    date: text(row.date) ?? "",
    time: text(row.time) ?? "",
    created_by: text(row.created_by),
    created_at: text(row.created_at) ?? "",
  };
}

export function readHealthRecord(value: unknown): HealthRecord | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.type !== "string" || typeof row.patient_id !== "string") {
    return null;
  }
  if (typeof row.description !== "string") return null;
  return {
    id: row.id,
    type: row.type,
    patient_id: row.patient_id,
    description: row.description,
    date_time: text(row.date_time),
    next_dose_at: text(row.next_dose_at),
    status: text(row.status),
    created_at: text(row.created_at),
    family_id: text(row.family_id),
  };
}

export function readKoreNote(value: unknown): KoreNote | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.sender_id !== "string" || typeof row.recipient_id !== "string") {
    return null;
  }
  return {
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    content: text(row.content),
    audio_url: text(row.audio_url),
    status: text(row.status),
    priority: text(row.priority),
    created_at: text(row.created_at),
    family_id: text(row.family_id),
  };
}

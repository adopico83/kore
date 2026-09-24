export type KoreTable =
  | "calendar_events"
  | "health_records"
  | "expenses"
  | "domains"
  | "kore_notes"
  | "profiles"
  | "shopping_items"
  | "cleaning_tasks"
  | "menu_items"
  | "school_events"
  | "school_materials"
  | "leisure_activities"
  | "sleep_logs"
  | "sleep_sessions"
  | "agent_memory";

export function emitKoreUpdate(tables: KoreTable[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("kore-update", { detail: { tables } }));
}

export function onKoreUpdate(callback: (tables: KoreTable[]) => void): () => void {
  const handler = (e: Event) => {
    const payload = (e as CustomEvent<{ tables?: KoreTable[] }>).detail;
    callback(Array.isArray(payload?.tables) ? payload.tables : []);
  };
  window.addEventListener("kore-update", handler);
  return () => window.removeEventListener("kore-update", handler);
}

export type KoreRemoteChange = {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  row: Record<string, unknown> | null;
  id: string | null;
};

/** Filas de Realtime ya normalizadas, para que cada vista las mezcle por id. */
export function emitKoreRemoteChanges(changes: KoreRemoteChange[]) {
  if (typeof window === "undefined" || changes.length === 0) return;
  window.dispatchEvent(new CustomEvent("kore-remote-change", { detail: changes }));
}

export function onKoreRemoteChanges(callback: (changes: KoreRemoteChange[]) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<KoreRemoteChange[]>).detail;
    callback(Array.isArray(detail) ? detail : []);
  };
  window.addEventListener("kore-remote-change", handler);
  return () => window.removeEventListener("kore-remote-change", handler);
}

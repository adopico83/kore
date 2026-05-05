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

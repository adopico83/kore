"use client";

import { useEffect, useRef } from "react";

import { getBrowserClient } from "@/lib/supabase/client";

const REALTIME_TABLES = [
  "expenses",
  "kore_notes",
  "health_records",
  "calendar_events",
  "domains",
  "profiles",
  "shopping_items",
  "cleaning_tasks",
  "menu_items",
  "sleep_logs",
  "sleep_sessions",
  "school_events",
] as const;

export type KoreRealtimeTable = (typeof REALTIME_TABLES)[number];

export type KoreRealtimeChange = {
  table: KoreRealtimeTable;
  event: "INSERT" | "UPDATE" | "DELETE";
  row: Record<string, unknown> | null;
  id: string | null;
};

function rowId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

/**
 * Suscripción Supabase Realtime a tablas críticas.
 * Entrega la fila (o el id en un borrado) para mezclarla en el estado local.
 * Memoriza el callback con `useRef` para no re-suscribir en cada render.
 */
export function useKoreRealtime(onUpdate: (change: KoreRealtimeChange) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const supabase = getBrowserClient();
    const channels = REALTIME_TABLES.map((table) =>
      supabase
        .channel(`kore-realtime:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            const event = payload.eventType;
            const source = event === "DELETE" ? payload.old : payload.new;
            onUpdateRef.current({
              table,
              event,
              row: event === "DELETE" || !source ? null : (source as Record<string, unknown>),
              id: rowId(source),
            });
          },
        )
        .subscribe(),
    );

    return () => {
      for (const ch of channels) {
        void supabase.removeChannel(ch);
      }
    };
  }, []);
}

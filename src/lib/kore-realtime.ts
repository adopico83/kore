"use client";

import { useEffect, useRef } from "react";

import { getBrowserClient } from "@/lib/supabase/client";

const supabase = getBrowserClient();

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

/**
 * Suscripción Supabase Realtime a tablas críticas.
 * Memoriza el callback con `useRef` para no re-suscribir en cada render;
 * igualmente conviene envolver `onUpdate` en `useCallback` en el padre.
 */
export function useKoreRealtime(onUpdate: (table: string) => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const channels = REALTIME_TABLES.map((table) =>
      supabase
        .channel(`kore-realtime:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            onUpdateRef.current(table);
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

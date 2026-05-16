"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { emitKoreUpdate } from "@/lib/kore-events";
import { addSchoolEvent, deleteSchoolEvent, getSchoolEvents } from "@/lib/actions/school";
import type { SchoolEventRow } from "@/lib/kore-db";

const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#e4e6ed",
  padding: "8px 10px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

/** date/time en iOS PWA: contraste y área táctil explícitos */
const dateTimeFieldStyle: CSSProperties = {
  ...fieldStyle,
  width: "100%",
  display: "block",
  minHeight: 44,
  color: "#e4e6ed",
  backgroundColor: "rgba(255,255,255,0.05)",
  colorScheme: "dark",
};

const EVENT_TYPES = ["reunion", "entrega", "excursion", "examen", "otro"] as const;

function formatDateLabel(date: string): string {
  const parts = date.slice(0, 10).split("-");
  if (parts.length < 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "No se pudo añadir el evento.";
}

export function SchoolDomainPanel() {
  const [events, setEvents] = useState<SchoolEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("otro");
  const [description, setDescription] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const reload = useCallback(async () => {
    setEventsLoading(true);
    try {
      const rows = await getSchoolEvents();
      const todayIso = new Date().toISOString().slice(0, 10);
      setEvents(rows.filter((e) => (e.date ?? "").slice(0, 10) >= todayIso));
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onAdd = async () => {
    setError(null);
    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!date) {
      setError("La fecha es obligatoria.");
      return;
    }

    setLoading(true);
    try {
      await addSchoolEvent({
        title: title.trim(),
        date,
        time: time.trim() || undefined,
        type,
        description: description.trim() || undefined,
      });
      emitKoreUpdate(["school_events", "calendar_events"]);
      setTitle("");
      setDate("");
      setTime("");
      setType("otro");
      setDescription("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    await deleteSchoolEvent(id);
    emitKoreUpdate(["school_events", "calendar_events"]);
    await reload();
  };

  const col: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

  return (
    <div style={col}>
      <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Nuevo evento escolar</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            style={dateTimeFieldStyle}
          />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={dateTimeFieldStyle} />
          <select value={type} onChange={(e) => setType(e.target.value as (typeof EVENT_TYPES)[number])} style={fieldStyle}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} style={fieldStyle} />
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#7F77DD",
              color: "#fff",
              padding: "10px 12px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Guardando…" : "Añadir y sincronizar agenda"}
          </button>
          {error ? (
            <p style={{ margin: 0, fontSize: 12, color: "#E05555", lineHeight: 1.4 }} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
      {eventsLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Cargando eventos…</p>
      ) : events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Sin eventos próximos.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {events.map((e) => (
            <li
              key={e.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
                padding: "8px 9px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                  {formatDateLabel(e.date)}
                  {e.time ? ` ${e.time.slice(0, 5)}` : ""} · {e.title}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                  {e.type ?? "otro"}
                  {e.description ? ` · ${e.description}` : ""}
                  {e.calendar_event_id ? " · en agenda" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onDelete(e.id)}
                style={{
                  flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#E05555",
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

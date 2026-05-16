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

const EVENT_TYPES = ["reunion", "entrega", "excursion", "examen", "otro"] as const;

const dateTimeContainerStyle: CSSProperties = {
  background: "#1c2028",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 12px",
  boxSizing: "border-box",
};

const dateTimeInputStyle: CSSProperties = {
  width: "100%",
  display: "block",
  marginTop: 6,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#e4e6ed",
  colorScheme: "dark",
  fontSize: 16,
  opacity: 1,
  outline: "none",
  boxSizing: "border-box",
  minHeight: 28,
};

function formatDateLabel(date: string): string {
  const parts = date.slice(0, 10).split("-");
  if (parts.length < 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTimeLabel(time: string): string {
  const t = time.trim();
  if (!t) return "";
  return t.slice(0, 5);
}

type DateTimeFieldProps = {
  kind: "date" | "time";
  value: string;
  onChange: (value: string) => void;
  min?: string;
  ariaLabel: string;
};

/** iOS PWA: valor visible en label; input nativo conserva el picker. */
function DateTimeField({ kind, value, onChange, min, ariaLabel }: DateTimeFieldProps) {
  const hasValue = value.trim().length > 0;
  const displayText = hasValue
    ? kind === "date"
      ? formatDateLabel(value)
      : formatTimeLabel(value)
    : "Toca para seleccionar";

  return (
    <label style={{ ...dateTimeContainerStyle, display: "block", cursor: "pointer" }}>
      <span
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: hasValue ? 600 : 400,
          color: hasValue ? "#e4e6ed" : "rgba(228,230,237,0.45)",
          lineHeight: 1.35,
        }}
      >
        {displayText}
      </span>
      <input
        type={kind}
        value={value}
        min={kind === "date" ? min : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        style={dateTimeInputStyle}
      />
    </label>
  );
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
          <DateTimeField kind="date" value={date} min={today} onChange={setDate} ariaLabel="Fecha del evento" />
          <DateTimeField kind="time" value={time} onChange={setTime} ariaLabel="Hora del evento (opcional)" />
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

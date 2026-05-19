"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { emitKoreUpdate } from "@/lib/kore-events";
import {
  addCleaningTask,
  completeCleaningTask,
  getPendingCleaningTasks,
  getUpcomingCleaningTasks,
} from "@/lib/actions/cleaning";
import type { CleaningTaskRow, Profile } from "@/lib/kore-db";

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

type Props = {
  profiles: Profile[];
};

function formatDueLabel(due: string | null): string {
  if (!due) return "—";
  const parts = due.slice(0, 10).split("-");
  if (parts.length < 3) return due;
  return `${parts[2]}/${parts[1]}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "No se pudo añadir la tarea.";
}

function TaskList({
  title,
  empty,
  tasks,
  nameFor,
  onComplete,
  accent,
}: {
  title: string;
  empty: string;
  tasks: CleaningTaskRow[];
  nameFor: (id: string | null) => string;
  onComplete: (id: string) => void;
  accent: string;
}) {
  return (
    <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: accent }}>{title}</p>
      {tasks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>{empty}</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {tasks.map((t) => (
            <li
              key={t.id}
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
                  {t.zone}: {t.task}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                  {t.frequency} · {nameFor(t.assigned_to)} · vence {formatDueLabel(t.next_due_at)}
                  {t.last_completed_at ? ` · última ${formatDueLabel(t.last_completed_at.slice(0, 10))}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onComplete(t.id)}
                style={{
                  flexShrink: 0,
                  border: "none",
                  borderRadius: 8,
                  background: "#4CC9A0",
                  color: "#0a1a14",
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Hecha
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CleaningDomainPanel({ profiles }: Props) {
  const adults = profiles.filter((p) => p.role !== "child");
  const [due, setDue] = useState<CleaningTaskRow[]>([]);
  const [upcoming, setUpcoming] = useState<CleaningTaskRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zone, setZone] = useState("");
  const [task, setTask] = useState("");
  const [frequency, setFrequency] = useState<"diaria" | "semanal" | "mensual">("semanal");
  const [assignedTo, setAssignedTo] = useState(adults[0]?.id ?? "");

  const reload = useCallback(async () => {
    setListLoading(true);
    try {
      const [d, u] = await Promise.all([getPendingCleaningTasks(), getUpcomingCleaningTasks(7)]);
      setDue(d);
      setUpcoming(u);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onAdd = async () => {
    setError(null);
    if (!zone.trim()) {
      setError("La zona es obligatoria.");
      return;
    }
    if (!task.trim()) {
      setError("La tarea es obligatoria.");
      return;
    }

    setLoading(true);
    try {
      await addCleaningTask({
        zone: zone.trim(),
        task: task.trim(),
        frequency,
        assigned_to: assignedTo || undefined,
      });
      emitKoreUpdate(["cleaning_tasks"]);
      setZone("");
      setTask("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onComplete = async (id: string) => {
    await completeCleaningTask(id);
    emitKoreUpdate(["cleaning_tasks"]);
    await reload();
  };

  const nameFor = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Nueva tarea recurrente</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Zona (ej. Cocina)" value={zone} onChange={(e) => setZone(e.target.value)} style={fieldStyle} />
          <input placeholder="Tarea" value={task} onChange={(e) => setTask(e.target.value)} style={fieldStyle} />
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} style={fieldStyle}>
            <option value="diaria">Diaria</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
          </select>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} style={fieldStyle}>
            {adults.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#4CC9A0",
              color: "#0a1a14",
              padding: "10px 12px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Guardando…" : "Añadir tarea"}
          </button>
          {error ? (
            <p style={{ margin: 0, fontSize: 12, color: "#E05555", lineHeight: 1.4 }} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {listLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Cargando tareas…</p>
      ) : (
        <>
          <TaskList title="Vencidas o para hoy" empty="Nada pendiente ahora." tasks={due} nameFor={nameFor} onComplete={onComplete} accent="#E05555" />
          <TaskList title="Próximos 7 días" empty="Sin tareas próximas." tasks={upcoming} nameFor={nameFor} onComplete={onComplete} accent="#EF9F27" />
        </>
      )}
    </div>
  );
}

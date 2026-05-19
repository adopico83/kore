"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { emitKoreUpdate } from "@/lib/kore-events";
import { addSleepSession, deleteSleepSession, getSleepSessions } from "@/lib/actions/sleep";
import { sleepSessionDurationHours, type Profile, type SleepSessionRow } from "@/lib/kore-db";
import { DateTimeLocalField } from "./DateTimeField";

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

type Props = { profiles: Profile[] };

function fromDatetimeLocalValue(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

function formatSessionWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SleepDomainPanel({ profiles }: Props) {
  const members = profiles.filter((p) => p.role !== "child");
  const allMembers = members.length > 0 ? members : profiles;
  const [sessions, setSessions] = useState<SleepSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState(allMembers[0]?.id ?? "");
  const [sleepStart, setSleepStart] = useState("");
  const [sleepEnd, setSleepEnd] = useState("");
  const [wakeCount, setWakeCount] = useState(0);
  const [notes, setNotes] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await getSleepSessions(14));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const nameFor = (id: string) => profiles.find((p) => p.id === id)?.name ?? "—";

  const onAdd = async () => {
    if (!profileId || !sleepStart || !sleepEnd) return;
    await addSleepSession({
      profile_id: profileId,
      sleep_start: fromDatetimeLocalValue(sleepStart),
      sleep_end: fromDatetimeLocalValue(sleepEnd),
      wake_count: wakeCount,
      notes: notes.trim() || null,
    });
    emitKoreUpdate(["sleep_sessions"]);
    setSleepStart("");
    setSleepEnd("");
    setWakeCount(0);
    setNotes("");
    await reload();
  };

  const onDelete = async (id: string) => {
    await deleteSleepSession(id);
    emitKoreUpdate(["sleep_sessions"]);
    await reload();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(228,230,237,0.65)" }}>Registrar sesión</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)} style={fieldStyle}>
            {allMembers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <DateTimeLocalField
            caption="Inicio"
            value={sleepStart}
            onChange={setSleepStart}
            ariaLabel="Inicio de la sesión de sueño"
          />
          <DateTimeLocalField
            caption="Fin"
            value={sleepEnd}
            onChange={setSleepEnd}
            ariaLabel="Fin de la sesión de sueño"
          />
          <input
            type="number"
            min={0}
            value={wakeCount}
            onChange={(e) => setWakeCount(Number(e.target.value) || 0)}
            placeholder="Despertares"
            style={fieldStyle}
          />
          <input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={fieldStyle} />
          <button
            type="button"
            onClick={() => void onAdd()}
            style={{
              border: "none",
              borderRadius: 8,
              background: "#9B8FE8",
              color: "#0a1a14",
              padding: "10px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Guardar sesión
          </button>
        </div>
      </section>
      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Cargando sesiones…</p>
      ) : sessions.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "rgba(228,230,237,0.55)" }}>Sin sesiones en los últimos 14 días.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {sessions.map((s) => {
            const hours = sleepSessionDurationHours(s.sleep_start, s.sleep_end);
            return (
              <li
                key={s.id}
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
                    {nameFor(s.profile_id)} · {hours}h
                    {s.wake_count > 0 ? ` · ${s.wake_count} despertar${s.wake_count === 1 ? "" : "es"}` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(228,230,237,0.55)" }}>
                    {formatSessionWhen(s.sleep_start)} → {formatSessionWhen(s.sleep_end)}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(s.id)}
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
            );
          })}
        </ul>
      )}
    </div>
  );
}

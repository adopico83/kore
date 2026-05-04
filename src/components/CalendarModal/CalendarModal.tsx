"use client";

import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type KoreAgendaEvent = {
  id: string;
  titulo: string;
  fecha: string;
  hora: string | null;
};

const DIAS_SEMANA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DOT_COLORS = ["#4CC9A0", "#9B8FE8", "#EF9F27"] as const;

const inputBase: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)",
  padding: "8px 10px",
  fontSize: 14,
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function construirCeldasMes(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const celdas: Array<{ dia: number | null; fechaStr: string | null }> = [];
  for (let i = 0; i < startOffset; i++) {
    celdas.push({ dia: null, fechaStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const fechaStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    celdas.push({ dia: d, fechaStr });
  }
  while (celdas.length % 7 !== 0) {
    celdas.push({ dia: null, fechaStr: null });
  }
  return celdas;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type CalendarEventDraft = { titulo: string; fecha: string; hora: string | null };
export type CalendarEventUpdateDraft = { titulo: string; hora: string | null };

export type CalendarModalProps = {
  onClose: () => void;
  events: KoreAgendaEvent[];
  initialDate?: Date | null;
  /** Modo local: mutaciones en memoria (sin handlers remotos). */
  onChange?: (next: KoreAgendaEvent[]) => void;
  /** Modo remoto: el padre persiste (p. ej. Supabase) y actualiza `events`. */
  onAddEvent?: (draft: CalendarEventDraft) => Promise<KoreAgendaEvent>;
  onUpdateEvent?: (id: string, draft: CalendarEventUpdateDraft) => Promise<void>;
  onDeleteEvent?: (id: string) => Promise<void>;
};

export function CalendarModal({
  onClose,
  events,
  onChange,
  initialDate,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
}: CalendarModalProps) {
  const useRemote = Boolean(onAddEvent && onUpdateEvent && onDeleteEvent);
  const [mesCalendario, setMesCalendario] = useState<Date>(() => new Date());
  const [diaDetalleFecha, setDiaDetalleFecha] = useState<string | null>(null);
  const [fechaHoyIso, setFechaHoyIso] = useState("");
  const [agendaEditandoId, setAgendaEditandoId] = useState<string | null>(null);
  const [draftTitulo, setDraftTitulo] = useState("");
  const [draftHora, setDraftHora] = useState("");
  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [agendaAccionLoading, setAgendaAccionLoading] = useState(false);

  useEffect(() => {
    setFechaHoyIso(ymd(new Date()));
  }, []);

  useEffect(() => {
    const base = initialDate ?? new Date();
    setMesCalendario(new Date(base.getFullYear(), base.getMonth(), 1));
    setDiaDetalleFecha(ymd(base));
    setAgendaEditandoId(null);
    setDraftTitulo("");
    setDraftHora("");
    setNuevoTitulo("");
    setNuevaHora("");
  }, [initialDate]);

  const eventosPorFecha = useMemo(() => {
    const map = new Map<string, KoreAgendaEvent[]>();
    for (const ev of events) {
      const key = (ev.fecha ?? "").slice(0, 10);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
    }
    return map;
  }, [events]);

  const celdasCalendario = useMemo(() => {
    const y = mesCalendario.getFullYear();
    const m = mesCalendario.getMonth();
    return construirCeldasMes(y, m);
  }, [mesCalendario]);

  const iniciarEdicion = (ev: KoreAgendaEvent) => {
    setAgendaEditandoId(ev.id);
    setDraftTitulo(ev.titulo);
    setDraftHora(ev.hora ?? "");
  };

  const cancelarEdicion = () => {
    setAgendaEditandoId(null);
    setDraftTitulo("");
    setDraftHora("");
  };

  const guardarEdicion = useCallback(async () => {
    if (!agendaEditandoId || agendaAccionLoading) return;
    const titulo = draftTitulo.trim();
    if (!titulo) return;
    setAgendaAccionLoading(true);
    try {
      const horaVal = draftHora.trim();
      if (useRemote && onUpdateEvent) {
        await onUpdateEvent(agendaEditandoId, { titulo, hora: horaVal.length > 0 ? horaVal : null });
      } else if (onChange) {
        onChange(
          events.map((e) =>
            e.id === agendaEditandoId ? { ...e, titulo, hora: horaVal.length > 0 ? horaVal : null } : e,
          ),
        );
      }
      cancelarEdicion();
    } finally {
      setAgendaAccionLoading(false);
    }
  }, [agendaAccionLoading, agendaEditandoId, draftHora, draftTitulo, events, onChange, onUpdateEvent, useRemote]);

  const eliminarEvento = useCallback(
    async (ev: KoreAgendaEvent) => {
      if (agendaAccionLoading) return;
      if (!window.confirm("¿Eliminar este evento?")) return;
      setAgendaAccionLoading(true);
      try {
        const fechaKey = (ev.fecha ?? "").slice(0, 10);
        if (useRemote && onDeleteEvent) {
          await onDeleteEvent(ev.id);
        } else if (onChange) {
          const next = events.filter((e) => e.id !== ev.id);
          onChange(next);
          if (diaDetalleFecha === fechaKey) {
            const quedan = next.filter((e) => (e.fecha ?? "").slice(0, 10) === fechaKey);
            if (quedan.length === 0) setDiaDetalleFecha(null);
          }
        }
        if (agendaEditandoId === ev.id) cancelarEdicion();
      } finally {
        setAgendaAccionLoading(false);
      }
    },
    [agendaAccionLoading, agendaEditandoId, diaDetalleFecha, events, onChange, onDeleteEvent, useRemote],
  );

  const añadirCita = useCallback(async () => {
    if (!diaDetalleFecha || agendaAccionLoading) return;
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;
    setAgendaAccionLoading(true);
    try {
      const horaVal = nuevaHora.trim();
      if (useRemote && onAddEvent) {
        await onAddEvent({ titulo, fecha: diaDetalleFecha, hora: horaVal.length > 0 ? horaVal : null });
      } else if (onChange) {
        const nuevo: KoreAgendaEvent = {
          id: newId(),
          titulo,
          fecha: diaDetalleFecha,
          hora: horaVal.length > 0 ? horaVal : null,
        };
        onChange([...events, nuevo]);
      }
      setNuevoTitulo("");
      setNuevaHora("");
    } finally {
      setAgendaAccionLoading(false);
    }
  }, [agendaAccionLoading, diaDetalleFecha, events, nuevaHora, nuevoTitulo, onAddEvent, onChange, useRemote]);

  const navBtn: CSSProperties = {
    display: "inline-flex",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    background: "transparent",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 7500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        padding: "12px 16px",
        boxSizing: "border-box",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "100%",
          maxHeight: "min(92vh, 900px)",
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid rgba(76, 201, 160, 0.45)",
          background: "#161a22",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kore-modal-cal-titulo"
      >
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 16px",
          }}
        >
          <h3 id="kore-modal-cal-titulo" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#4CC9A0" }}>
            Calendario familiar
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 8,
              padding: 8,
              color: "rgba(255,255,255,0.85)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Cerrar calendario"
          >
            <X width={20} height={20} aria-hidden />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 16px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDiaDetalleFecha(null);
              setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            }}
            style={navBtn}
            aria-label="Mes anterior"
          >
            <ChevronLeft width={20} height={20} />
          </button>
          <p
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              textTransform: "capitalize",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              padding: "0 4px",
            }}
          >
            {new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1).toLocaleDateString("es-ES", {
              month: "long",
              year: "numeric",
            })}
          </p>
          <button
            type="button"
            onClick={() => {
              setDiaDetalleFecha(null);
              setMesCalendario((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            }}
            style={navBtn}
            aria-label="Mes siguiente"
          >
            <ChevronRight width={20} height={20} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flex: 1,
            overflowY: "auto",
            padding: "0 16px 16px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              marginBottom: 8,
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            {DIAS_SEMANA_CORTO.map((d) => (
              <div key={d} style={{ padding: "4px 0" }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {celdasCalendario.map((celda, idx) => {
              if (!celda.dia || !celda.fechaStr) {
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{ minHeight: 52, borderRadius: 8, background: "transparent" }}
                  />
                );
              }
              const { fechaStr } = celda;
              const eventosDia = eventosPorFecha.get(fechaStr) ?? [];
              const tieneEventos = eventosDia.length > 0;
              const esHoy = fechaStr === fechaHoyIso;
              const esPasado = !!fechaHoyIso && fechaStr < fechaHoyIso;

              return (
                <button
                  key={fechaStr}
                  type="button"
                  onClick={() => setDiaDetalleFecha(fechaStr)}
                  style={{
                    display: "flex",
                    minHeight: 52,
                    minWidth: 0,
                    flexDirection: "column",
                    alignItems: "stretch",
                    borderRadius: 8,
                    border: esHoy ? "1px solid #4CC9A0" : "1px solid rgba(255,255,255,0.1)",
                    background: esHoy ? "rgba(9,11,16,0.9)" : "rgba(9,11,16,0.5)",
                    padding: 4,
                    textAlign: "left",
                    cursor: "pointer",
                    opacity: esPasado ? 0.5 : 1,
                    color: "inherit",
                    font: "inherit",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#fff" }}>{celda.dia}</span>
                  <div
                    style={{
                      marginTop: 2,
                      display: "flex",
                      minHeight: 0,
                      flex: 1,
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      gap: 2,
                    }}
                  >
                    {tieneEventos ? (
                      <>
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: 10,
                            fontWeight: 500,
                            lineHeight: 1.2,
                            color: "#4CC9A0",
                          }}
                        >
                          {eventosDia[0]?.titulo ?? "Evento"}
                        </span>
                        {eventosDia.length > 1 ? (
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
                            +{eventosDia.length - 1} más
                          </span>
                        ) : null}
                        <span
                          style={{ display: "flex", justifyContent: "center", gap: 4, paddingTop: 2 }}
                          aria-hidden
                        >
                          {eventosDia.slice(0, 3).map((_, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                flexShrink: 0,
                                borderRadius: "50%",
                                backgroundColor: DOT_COLORS[i % DOT_COLORS.length],
                              }}
                            />
                          ))}
                        </span>
                      </>
                    ) : (
                      <span style={{ marginTop: "auto", opacity: 0, fontSize: 1 }}> </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {diaDetalleFecha ? (
            <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#9B8FE8" }}>
                {new Date(`${diaDetalleFecha}T12:00:00`).toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>

              <ul
                style={{
                  margin: "0 0 16px",
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {(eventosPorFecha.get(diaDetalleFecha) ?? []).length === 0 ? (
                  <li style={{ fontSize: 14, color: "rgba(255,255,255,0.55)" }}>Sin citas este día.</li>
                ) : null}
                {(eventosPorFecha.get(diaDetalleFecha) ?? []).map((ev) => (
                  <li
                    key={ev.id}
                    style={{
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(9,11,16,0.95)",
                      padding: "10px 12px",
                    }}
                  >
                    {agendaEditandoId === ev.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          type="text"
                          value={draftTitulo}
                          onChange={(e) => setDraftTitulo(e.target.value)}
                          disabled={agendaAccionLoading}
                          placeholder="Título"
                          style={{ ...inputBase, background: "rgba(255,255,255,0.1)" }}
                        />
                        <input
                          type="text"
                          value={draftHora}
                          onChange={(e) => setDraftHora(e.target.value)}
                          disabled={agendaAccionLoading}
                          placeholder="Hora (opcional)"
                          style={{ ...inputBase, background: "rgba(255,255,255,0.1)" }}
                        />
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
                          <button
                            type="button"
                            onClick={cancelarEdicion}
                            disabled={agendaAccionLoading}
                            style={{
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.25)",
                              padding: "6px 12px",
                              fontSize: 14,
                              color: "rgba(255,255,255,0.9)",
                              background: "transparent",
                              cursor: agendaAccionLoading ? "not-allowed" : "pointer",
                              opacity: agendaAccionLoading ? 0.5 : 1,
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void guardarEdicion()}
                            disabled={agendaAccionLoading || !draftTitulo.trim()}
                            style={{
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#090b10",
                              background: "#4CC9A0",
                              border: "none",
                              cursor: agendaAccionLoading || !draftTitulo.trim() ? "not-allowed" : "pointer",
                              opacity: agendaAccionLoading || !draftTitulo.trim() ? 0.5 : 1,
                            }}
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#fff" }}>{ev.titulo}</p>
                          {ev.hora ? (
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4CC9A0" }}>{ev.hora}</p>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => iniciarEdicion(ev)}
                            disabled={agendaAccionLoading}
                            style={{
                              borderRadius: 8,
                              padding: 8,
                              color: "rgba(255,255,255,0.85)",
                              background: "transparent",
                              border: "none",
                              cursor: agendaAccionLoading ? "not-allowed" : "pointer",
                              opacity: agendaAccionLoading ? 0.5 : 1,
                            }}
                            title="Editar"
                            aria-label="Editar evento"
                          >
                            <Pencil width={16} height={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void eliminarEvento(ev)}
                            disabled={agendaAccionLoading}
                            style={{
                              borderRadius: 8,
                              padding: 8,
                              color: "#f87171",
                              background: "transparent",
                              border: "none",
                              cursor: agendaAccionLoading ? "not-allowed" : "pointer",
                              opacity: agendaAccionLoading ? 0.5 : 1,
                            }}
                            title="Eliminar"
                            aria-label="Eliminar evento"
                          >
                            <Trash2 width={16} height={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(9,11,16,0.8)",
                  padding: 12,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Nueva cita
                </p>
                <input
                  type="text"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  disabled={agendaAccionLoading}
                  placeholder="Título"
                  style={{
                    ...inputBase,
                    opacity: agendaAccionLoading ? 0.6 : 1,
                  }}
                />
                <input
                  type="text"
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  disabled={agendaAccionLoading}
                  placeholder="Hora (opcional, ej. 10:30)"
                  style={{
                    ...inputBase,
                    opacity: agendaAccionLoading ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => void añadirCita()}
                  disabled={agendaAccionLoading || !nuevoTitulo.trim()}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    padding: "8px 0",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#090b10",
                    background: "#4CC9A0",
                    border: "none",
                    cursor: agendaAccionLoading || !nuevoTitulo.trim() ? "not-allowed" : "pointer",
                    opacity: agendaAccionLoading || !nuevoTitulo.trim() ? 0.5 : 1,
                  }}
                >
                  Añadir
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

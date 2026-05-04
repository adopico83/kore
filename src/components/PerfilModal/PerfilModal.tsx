"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

export type PerfilUsuario = "Ander" | "Leire";

export type PerfilNavigateTipo = "domain" | "salud";

export type PerfilDomainRow = {
  id: string;
  name: string;
  owner: string;
  state: string;
  emoji: string;
  notes?: string[];
};

export type PerfilCitaRow = {
  id: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
};

export type PerfilSaludSlice = {
  citas: PerfilCitaRow[];
};

export type PerfilModalProps = {
  usuario: PerfilUsuario;
  onClose: () => void;
  domains: PerfilDomainRow[];
  saludMember: PerfilSaludSlice;
  stressLevel: number;
  onStressChange: (level: number) => void;
  onNavigate: (tipo: PerfilNavigateTipo, id: string) => void;
};

const BG = "#090b10";
const CARD = "#161a22";
const TEXT = "#e4e6ed";
const MUTED = "rgba(228, 230, 237, 0.45)";
const LS_KORE_DOMAINS_STATE = "kore_domains_state";
const LS_KORE_SALUD = "kore_salud";

function stressBarColor(level: number): string {
  if (level <= 4) return "#4CC9A0";
  if (level <= 7) return "#EF9F27";
  return "#E05555";
}

function stressAvatarBorder(level: number): string {
  if (level <= 4) return "#10b981";
  if (level <= 7) return "#f59e0b";
  return "#E05555";
}

function clampStress(n: number): number {
  if (Number.isNaN(n)) return 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function nombreCompleto(usuario: PerfilUsuario): string {
  return usuario === "Ander" ? "Ander Dopico" : "Leire Gómez";
}

function parseCitaDate(fecha: string, hora: string): number {
  const f = (fecha ?? "").trim();
  const h = (hora ?? "").trim();
  const t = `${f}T${h.length >= 5 ? h : "00:00"}`;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

function misDominios(domains: PerfilDomainRow[], usuario: PerfilUsuario): PerfilDomainRow[] {
  return domains.filter((d) => d.owner === usuario);
}

function misTareas(
  domains: PerfilDomainRow[],
  usuario: PerfilUsuario,
  max: number,
): Array<{ text: string; emoji: string; name: string; domainId: string }> {
  const owned = domains.filter((d) => d.owner === usuario);
  const out: Array<{ text: string; emoji: string; name: string; domainId: string }> = [];
  for (const d of owned) {
    const notes = d.notes ?? [];
    for (let i = notes.length - 1; i >= 0 && out.length < max; i--) {
      const text = notes[i]?.trim();
      if (text) out.push({ text, emoji: d.emoji, name: d.name, domainId: d.id });
    }
  }
  return out;
}

function proximasCitas(citas: PerfilCitaRow[], max: number): PerfilCitaRow[] {
  return [...citas]
    .sort((a, b) => parseCitaDate(a.fecha, a.hora) - parseCitaDate(b.fecha, b.hora))
    .slice(0, max);
}

const sectionTitle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: MUTED,
};

const card: CSSProperties = {
  background: CARD,
  border: "0.5px solid rgba(255, 255, 255, 0.07)",
  borderRadius: 14,
  padding: 14,
  marginBottom: 12,
};

export function PerfilModal({
  usuario,
  onClose,
  domains,
  saludMember,
  stressLevel,
  onStressChange,
  onNavigate,
}: PerfilModalProps) {
  const [domainRows, setDomainRows] = useState<PerfilDomainRow[]>(domains);
  const [citasRows, setCitasRows] = useState<PerfilCitaRow[]>(saludMember.citas ?? []);
  const [hoverNavKey, setHoverNavKey] = useState<string | null>(null);

  const stress = clampStress(stressLevel);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const rawD = localStorage.getItem(LS_KORE_DOMAINS_STATE);
        if (rawD) {
          const p = JSON.parse(rawD) as PerfilDomainRow[];
          if (Array.isArray(p) && p.length > 0) {
            setDomainRows(p);
          } else {
            setDomainRows(domains);
          }
        } else {
          setDomainRows(domains);
        }
      } catch {
        setDomainRows(domains);
      }
      try {
        const rawS = localStorage.getItem(LS_KORE_SALUD);
        if (rawS) {
          const data = JSON.parse(rawS) as Record<string, { citas?: PerfilCitaRow[] }>;
          const m = data[usuario];
          if (m?.citas && Array.isArray(m.citas)) {
            setCitasRows(m.citas);
          } else {
            setCitasRows(saludMember.citas ?? []);
          }
        } else {
          setCitasRows(saludMember.citas ?? []);
        }
      } catch {
        setCitasRows(saludMember.citas ?? []);
      }
    });
  }, [usuario, domains, saludMember]);

  const barColor = stressBarColor(stress);
  const avatarBorder = stressAvatarBorder(stress);

  const dominios = useMemo(() => misDominios(domainRows, usuario), [domainRows, usuario]);
  const tareas = useMemo(() => misTareas(domainRows, usuario, 5), [domainRows, usuario]);
  const citas = useMemo(() => proximasCitas(citasRows, 5), [citasRows]);

  const navRowBg = (key: string) =>
    hoverNavKey === key ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)";

  const handleBarPointer = (clientX: number, currentTarget: HTMLDivElement) => {
    const rect = currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const next = clampStress(Math.ceil(ratio * 10) || 1);
    onStressChange(next);
  };

  const initial = usuario === "Ander" ? "A" : "L";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${usuario}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8200,
        background: "rgba(6, 7, 10, 0.72)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) 12px 12px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          borderRadius: 16,
          border: "0.5px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "16px 16px 12px",
            borderBottom: "0.5px solid rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              color: TEXT,
              background: CARD,
              border: `3px solid ${avatarBorder}`,
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>{nombreCompleto(usuario)}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>Household OS — Perfil</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "0.5px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: TEXT,
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 16,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={card}>
            <p style={sectionTitle}>Saturación</p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: TEXT }}>Nivel de energía hoy</p>
            <div
              role="slider"
              aria-valuemin={1}
              aria-valuemax={10}
              aria-valuenow={stress}
              aria-label="Nivel de energía"
              onClick={(e) => handleBarPointer(e.clientX, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = clampStress(stress - 1);
                  onStressChange(next);
                }
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = clampStress(stress + 1);
                  onStressChange(next);
                }
              }}
              tabIndex={0}
              style={{
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                position: "relative",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${(stress / 10) * 100}%`,
                  borderRadius: 12,
                  background: barColor,
                  pointerEvents: "none",
                  transition: "width 0.12s ease-out",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  color: stress >= 5 ? TEXT : "#0a1a14",
                  textShadow: stress >= 5 ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                  pointerEvents: "none",
                }}
              >
                {stress}/10
              </div>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: MUTED }}>Toca la barra para ajustar el nivel.</p>
          </div>

          <div style={card}>
            <p style={sectionTitle}>Mis dominios</p>
            {dominios.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Sin dominios asignados.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {dominios.map((d) => {
                  const hk = `dom-${d.id}`;
                  return (
                    <li key={d.id} style={{ margin: 0, padding: 0 }}>
                      <button
                        type="button"
                        onClick={() => onNavigate("domain", d.id)}
                        onMouseEnter={() => setHoverNavKey(hk)}
                        onMouseLeave={() => setHoverNavKey(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: navRowBg(hk),
                          border: "0.5px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          textAlign: "left",
                          font: "inherit",
                          color: "inherit",
                          boxSizing: "border-box",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{d.emoji}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>{d.name}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{d.state}</p>
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 14, color: MUTED }} aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div style={card}>
            <p style={sectionTitle}>Mis citas próximas</p>
            {citas.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Sin citas próximas.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {citas.map((c) => {
                  const hk = `cita-${c.id}`;
                  return (
                    <li key={c.id} style={{ margin: 0, padding: 0 }}>
                      <button
                        type="button"
                        onClick={() => onNavigate("salud", usuario)}
                        onMouseEnter={() => setHoverNavKey(hk)}
                        onMouseLeave={() => setHoverNavKey(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: navRowBg(hk),
                          border: "0.5px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          textAlign: "left",
                          font: "inherit",
                          color: "inherit",
                          boxSizing: "border-box",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>
                            {(c.fecha ?? "").trim()} · {(c.hora ?? "").trim()}
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 600, color: TEXT }}>{c.descripcion}</p>
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 14, color: MUTED }} aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div style={{ ...card, marginBottom: 0 }}>
            <p style={sectionTitle}>Mis tareas</p>
            {tareas.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>Sin tareas en tus dominios.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {tareas.map((t, i) => {
                  const hk = `task-${t.domainId}-${i}-${t.text.slice(0, 12)}`;
                  return (
                    <li key={hk} style={{ margin: 0, padding: 0 }}>
                      <button
                        type="button"
                        onClick={() => onNavigate("domain", t.domainId)}
                        onMouseEnter={() => setHoverNavKey(hk)}
                        onMouseLeave={() => setHoverNavKey(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: navRowBg(hk),
                          border: "0.5px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                          textAlign: "left",
                          font: "inherit",
                          color: "inherit",
                          boxSizing: "border-box",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{t.emoji}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 11, color: MUTED }}>{t.name}</p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: TEXT }}>{t.text}</p>
                        </div>
                        <span style={{ flexShrink: 0, fontSize: 14, color: MUTED }} aria-hidden>
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

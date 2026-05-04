"use client";

import { AgentChat } from "@/components/AgentChat/AgentChat";
import {
  CalendarModal,
  type KoreAgendaEvent,
} from "@/components/CalendarModal/CalendarModal";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const LS_KORE_AGENDA = "kore_calendar_events";

function readAgendaFromLs(): KoreAgendaEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KORE_AGENDA);
    if (!raw) return [];
    const p = JSON.parse(raw) as KoreAgendaEvent[];
    if (!Array.isArray(p)) return [];
    return p.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.titulo === "string" &&
        typeof e.fecha === "string",
    );
  } catch {
    return [];
  }
}

const C = {
  bg: "#090b10",
  card: "#161a22",
  text: "#e4e6ed",
  muted: "rgba(228, 230, 237, 0.45)",
  label: "rgba(228, 230, 237, 0.18)",
  border: "0.5px solid rgba(255, 255, 255, 0.07)",
  green: "#4CC9A0",
  purple: "#9B8FE8",
  amber: "#EF9F27",
  red: "#E05555",
} as const;

const sectionLabel: CSSProperties = {
  fontSize: "8.5px",
  fontFamily: "ui-monospace, monospace",
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: C.label,
  margin: "0 16px 10px",
};

const cardShell: CSSProperties = {
  background: C.card,
  border: C.border,
  borderRadius: "14px",
  padding: "14px",
  margin: "16px",
  color: C.text,
};

function Waveform() {
  const heights = [4, 12, 7, 16, 9, 14, 6, 11, 5, 13, 8, 10];
  return (
    <div
      style={{
        display: "flex",
        height: 32,
        alignItems: "center",
        gap: 2,
      }}
      aria-label="Nota de voz"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 2,
            borderRadius: 999,
            backgroundColor: C.purple,
            height: h,
          }}
        />
      ))}
    </div>
  );
}

type WeekDay = {
  key: string;
  label: string;
  num: number;
  isToday: boolean;
  dots: string[];
  date: Date;
};

function ymdParts(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ymdIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dotsForDate(d: Date, events: KoreAgendaEvent[]): string[] {
  const iso = ymdIso(d);
  const list = events.filter((e) => (e.fecha ?? "").slice(0, 10) === iso);
  const palette = ["#4CC9A0", "#9B8FE8", "#EF9F27", "#E05555"];
  return list.slice(0, 4).map((_, i) => palette[i % palette.length]);
}

function buildWeekDays(reference: Date, events: KoreAgendaEvent[]): WeekDay[] {
  const d = new Date(reference);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(d.getDate() + mondayOffset);

  const labels = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const todayKey = ymdParts(reference);

  return labels.map((label, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const key = ymdParts(dt);
    return {
      key,
      label,
      num: dt.getDate(),
      isToday: key === todayKey,
      dots: dotsForDate(dt, events),
      date: dt,
    };
  });
}

type DomainCard = {
  name: string;
  owner: string;
  weight: number;
  emoji: string;
  state: string;
  line: string;
  agent?: string;
};

const DOMAINS: DomainCard[] = [
  { name: "Menú", owner: "Ander", weight: 8, emoji: "🍽️", state: "En curso", line: "#4CC9A0" },
  { name: "Sueño", owner: "Leire", weight: 15, emoji: "😴", state: "Prioritario", line: "#9B8FE8" },
  { name: "Limpieza", owner: "Leire", weight: 5, emoji: "🧹", state: "OK", line: "#EF9F27" },
  { name: "Compras", owner: "Ander", weight: 4, emoji: "🛒", state: "Pendiente", line: "#4CC9A0" },
  {
    name: "Colegio",
    owner: "Leire",
    weight: 6,
    emoji: "🎒",
    state: "Excursión 15 mayo",
    line: "#7F77DD",
    agent: "logistica",
  },
];

const EXPENSES = [
  { icon: "🛒", desc: "Mercadona", date: "2 may", amount: "-84,20€" },
  { icon: "☕", desc: "Cafés semana", date: "1 may", amount: "-32,50€" },
  { icon: "🧸", desc: "Juguetes Peque", date: "28 abr", amount: "-119,00€" },
];

export default function Home() {
  const [showAgent, setShowAgent] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | null>(null);
  const [agendaEvents, setAgendaEvents] = useState<KoreAgendaEvent[]>([]);
  const [agendaHydrated, setAgendaHydrated] = useState(false);

  const [domainsOpen, setDomainsOpen] = useState(true);
  const [healthOpen, setHealthOpen] = useState(false);
  const [anderStress, setAnderStress] = useState(9);
  const [leireStress, setLeireStress] = useState(8);

  useEffect(() => {
    setAgendaEvents(readAgendaFromLs());
    setAgendaHydrated(true);
  }, []);

  useEffect(() => {
    if (!agendaHydrated) return;
    try {
      localStorage.setItem(LS_KORE_AGENDA, JSON.stringify(agendaEvents));
    } catch {
      /* ignore */
    }
  }, [agendaEvents, agendaHydrated]);

  const weekDays = useMemo(() => buildWeekDays(new Date(), agendaEvents), [agendaEvents]);
  const stressSum = anderStress + leireStress;
  const survival = stressSum > 16;

  const avatarBase: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    color: C.text,
    background: C.card,
    borderWidth: 2,
    borderStyle: "solid",
    boxSizing: "border-box",
  };

  const mobileShell: CSSProperties = {
    width: "100%",
    maxWidth: 390,
    margin: "0 auto",
    minHeight: "100vh",
    maxHeight: "100vh",
    background: "#090b10",
    position: "relative",
    overflow: "hidden",
    transform: "translateZ(0)",
    boxSizing: "border-box",
    color: C.text,
    display: "flex",
    flexDirection: "column",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06070a",
        boxSizing: "border-box",
      }}
    >
      <div style={mobileShell}>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: C.bg,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "0.5px solid rgba(255, 255, 255, 0.07)",
          zIndex: 300,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, minWidth: 0 }}>
          <svg width="32" height="32" viewBox="0 0 160 160" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <rect width="160" height="160" rx="36" fill="#0b0d13" />
            <circle cx="68" cy="80" r="36" stroke="#4CC9A0" strokeWidth="1.8" fill="none" />
            <circle cx="96" cy="80" r="36" stroke="#9B8FE8" strokeWidth="1.8" fill="none" />
            <circle cx="82" cy="80" r="7" fill="white" opacity="0.95" />
            <circle cx="82" cy="80" r="14" fill="white" opacity="0.05" />
          </svg>
          <p
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: "#e4e6ed",
              lineHeight: 1.1,
            }}
          >
            Kore
          </p>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 4px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(228, 230, 237, 0.35)",
              letterSpacing: "1px",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Familia Dopico · Gómez
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
          <span
            style={{
              ...avatarBase,
              position: "relative",
              zIndex: 1,
              borderColor: "#10b981",
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.3)",
            }}
          >
            A
          </span>
          <span
            style={{
              ...avatarBase,
              position: "relative",
              zIndex: 2,
              borderColor: "#f59e0b",
              boxShadow: "0 0 12px rgba(245, 158, 11, 0.3)",
              marginLeft: -10,
            }}
          >
            L
          </span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          width: "100%",
          margin: 0,
          paddingTop: 88,
          paddingBottom: 120,
          boxSizing: "border-box",
        }}
      >
        {/* Agenda */}
        <section>
          <p style={{ ...sectionLabel, marginBottom: 10 }}>Agenda familiar</p>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              padding: "0 16px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {weekDays.map((day) => (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  setCalendarInitialDate(day.date);
                  setShowCalendar(true);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  background: day.isToday ? "rgba(76, 201, 160, 0.08)" : "#161a22",
                  border: day.isToday
                    ? "0.5px solid rgba(76, 201, 160, 0.3)"
                    : "0.5px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  minWidth: 65,
                  flexShrink: 0,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 9,
                    textTransform: "uppercase",
                    color: C.muted,
                  }}
                >
                  {day.label}
                </span>
                <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{day.num}</span>
                <div style={{ display: "flex", height: 8, alignItems: "center", gap: 4 }}>
                  {day.dots.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: c,
                      }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Dominios */}
        <section style={cardShell}>
          <button
            type="button"
            onClick={() => setDomainsOpen((o) => !o)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              textAlign: "left",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: C.text,
            }}
          >
            <span style={{ ...sectionLabel, margin: 0 }}>Dominios</span>
            <span
              style={{
                color: C.muted,
                display: "inline-block",
                transform: domainsOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden
            >
              ▼
            </span>
          </button>
          {domainsOpen ? (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {DOMAINS.slice(0, 4).map((d) => (
                  <div
                    key={d.name}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        backgroundColor: d.line,
                      }}
                    />
                    <div style={{ paddingTop: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 4,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{d.emoji}</span>
                        <span
                          style={{
                            borderRadius: 999,
                            border: "0.5px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            padding: "2px 8px",
                            fontSize: 10,
                            color: C.muted,
                          }}
                        >
                          {d.owner}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>{d.name}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>{d.state}</p>
                      {d.agent ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 9,
                            fontFamily: "ui-monospace, monospace",
                            color: "rgba(228,230,237,0.35)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Agent: {d.agent}
                        </p>
                      ) : null}
                      <div
                        style={{
                          marginTop: 12,
                          height: 6,
                          overflow: "hidden",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            background: d.line,
                            width: `${(d.weight / 15) * 100}%`,
                          }}
                        />
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 10,
                          color: C.muted,
                        }}
                      >
                        {d.weight}/15
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {DOMAINS.slice(4).map((d) => (
                <div
                  key={d.name}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    maxWidth: "100%",
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        backgroundColor: d.line,
                      }}
                    />
                    <div style={{ paddingTop: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 4,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{d.emoji}</span>
                        <span
                          style={{
                            borderRadius: 999,
                            border: "0.5px solid rgba(255,255,255,0.1)",
                            background: "rgba(255,255,255,0.04)",
                            padding: "2px 8px",
                            fontSize: 10,
                            color: C.muted,
                          }}
                        >
                          {d.owner}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>{d.name}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>{d.state}</p>
                      {d.agent ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 9,
                            fontFamily: "ui-monospace, monospace",
                            color: "rgba(228,230,237,0.35)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Agent: {d.agent}
                        </p>
                      ) : null}
                      <div
                        style={{
                          marginTop: 12,
                          height: 6,
                          overflow: "hidden",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            background: d.line,
                            width: `${(d.weight / 15) * 100}%`,
                          }}
                        />
                      </div>
                      <p
                        style={{
                          margin: "6px 0 0",
                          textAlign: "right",
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 10,
                          color: C.muted,
                        }}
                      >
                        {d.weight}/15
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Salud */}
        <section
          style={{
            ...cardShell,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setHealthOpen((o) => !o)}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 12,
              padding: 14,
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.text,
            }}
          >
            <span style={{ fontSize: 24 }} aria-hidden>
              🏥
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Salud familiar</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Citas y medicación</p>
            </div>
            <span
              style={{
                borderRadius: 999,
                background: "rgba(239, 159, 39, 0.2)",
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: C.amber,
                flexShrink: 0,
              }}
            >
              3 pendientes
            </span>
            <span style={{ color: C.muted, flexShrink: 0 }} aria-hidden>
              {healthOpen ? "▼" : "▶"}
            </span>
          </button>
          {healthOpen ? (
            <div
              style={{
                borderTop: "0.5px solid rgba(255,255,255,0.07)",
                padding: "12px 14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.green,
                  }}
                >
                  Peque
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      borderLeft: `2px solid ${C.green}`,
                      paddingLeft: 8,
                      fontSize: 14,
                      color: C.text,
                    }}
                  >
                    <span>Apiretal</span>
                    <span style={{ flexShrink: 0, color: C.muted, fontSize: 13 }}>próx. 12:30</span>
                  </li>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      borderLeft: `2px solid ${C.purple}`,
                      paddingLeft: 8,
                      fontSize: 14,
                      color: C.text,
                    }}
                  >
                    <span>Pediatra</span>
                    <span style={{ flexShrink: 0, color: C.muted, fontSize: 13 }}>Vie 10:00</span>
                  </li>
                </ul>
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.muted,
                  }}
                >
                  Ander
                </p>
                <p style={{ margin: 0, fontSize: 14, color: C.muted }}>Sin citas próximas</p>
              </div>
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: C.amber,
                  }}
                >
                  Leire
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  <li
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      borderLeft: `2px solid ${C.amber}`,
                      paddingLeft: 8,
                      fontSize: 14,
                      color: C.text,
                    }}
                  >
                    <span>Dentista</span>
                    <span style={{ flexShrink: 0, color: C.muted, fontSize: 13 }}>28 feb</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </section>

        {/* El corcho */}
        <section>
          <p style={{ ...sectionLabel, marginBottom: 10 }}>El corcho</p>
          <div style={{ padding: "0 16px 16px", boxSizing: "border-box" }}>
            <div
              style={{
                background: "#161a22",
                border: "0.5px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  ...avatarBase,
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderColor: "#f59e0b",
                  background: "#12151c",
                }}
              >
                L
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: C.text }}>Leire</span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: C.green,
                      flexShrink: 0,
                    }}
                    title="No leído"
                  />
                </div>
                <Waveform />
                <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>Hace 12 min</p>
              </div>
            </div>
            <div
              style={{
                background: "#161a22",
                border: "0.5px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  ...avatarBase,
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  borderColor: "#10b981",
                  background: "#12151c",
                }}
              >
                A
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, color: C.text }}>Ander</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: C.text, opacity: 0.95 }}>
                  ¿Puedes recoger pan antes de las 19:00?
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>Ayer 21:40</p>
              </div>
            </div>
          </div>
        </section>

        {/* Economía */}
        <section style={cardShell}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              💶
            </span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Balance mayo</p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                padding: 12,
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: C.muted,
                }}
              >
                Gastos mes
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 700, color: C.red }}>−1.240€</p>
            </div>
            <div
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                padding: 12,
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: C.muted,
                }}
              >
                Ander debe
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 700, color: C.green }}>+85€</p>
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {EXPENSES.map((e) => (
              <li key={e.desc} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
                <span style={{ fontSize: 20 }}>{e.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: C.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.desc}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>{e.date}</p>
                </div>
                <span style={{ flexShrink: 0, fontFamily: "ui-monospace, monospace", color: C.red }}>{e.amount}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Termómetro */}
        <section style={{ ...cardShell, marginBottom: 120 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span aria-hidden>❤️</span>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Check-in nocturno</p>
          </div>
          {survival ? (
            <div
              style={{
                marginBottom: 16,
                borderRadius: 12,
                border: "0.5px solid rgba(239, 159, 39, 0.45)",
                background: "rgba(239, 159, 39, 0.18)",
                padding: "10px 12px",
                textAlign: "center",
                fontSize: 14,
                fontWeight: 600,
                color: C.amber,
              }}
            >
              Survival mode — suma de estrés mayor que 16
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button
              type="button"
              onClick={() => setAnderStress((n) => (n >= 15 ? 1 : n + 1))}
              style={{
                display: "block",
                width: "100%",
                borderRadius: 12,
                border: "0.5px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: 12,
                textAlign: "left",
                cursor: "pointer",
                color: C.text,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: C.muted }}>Ander</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{anderStress}</span>
              </div>
              <div
                style={{
                  height: 8,
                  overflow: "hidden",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: C.green,
                    width: `${(anderStress / 15) * 100}%`,
                  }}
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() => setLeireStress((n) => (n >= 15 ? 1 : n + 1))}
              style={{
                display: "block",
                width: "100%",
                borderRadius: 12,
                border: "0.5px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: 12,
                textAlign: "left",
                cursor: "pointer",
                color: C.text,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: C.muted }}>Leire</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{leireStress}</span>
              </div>
              <div
                style={{
                  height: 8,
                  overflow: "hidden",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: C.purple,
                    width: `${(leireStress / 15) * 100}%`,
                  }}
                />
              </div>
            </button>
          </div>
        </section>
      </main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: "linear-gradient(to top, #090b10 75%, transparent)",
          padding: "14px 40px 34px",
          display: "flex",
          justifyContent: "center",
          gap: 20,
          zIndex: 400,
          boxSizing: "border-box",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          aria-label="Mensaje a Leire"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#161a22",
            border: "1px solid rgba(255, 255, 255, 0.13)",
            fontSize: 22,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
          }}
        >
          💬
        </button>
        <button
          type="button"
          onClick={() => setShowAgent(true)}
          aria-label="ORC / Agente"
          style={{
            width: 66,
            height: 66,
            borderRadius: "50%",
            background: "#4CC9A0",
            color: "#0a1a14",
            fontSize: 22,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✦
        </button>
      </nav>

      {showAgent ? <AgentChat onClose={() => setShowAgent(false)} /> : null}

      {showCalendar ? (
        <CalendarModal
          onClose={() => {
            setShowCalendar(false);
            setCalendarInitialDate(null);
          }}
          events={agendaEvents}
          onChange={setAgendaEvents}
          initialDate={calendarInitialDate}
        />
      ) : null}
      </div>
    </div>
  );
}

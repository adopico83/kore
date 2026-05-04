"use client";

import { AgentChat } from "@/components/AgentChat/AgentChat";
import { CorchoChat } from "@/components/CorchoChat";
import { CorchoHistorial } from "@/components/CorchoHistorial";
import { DomainModal, type DomainItem } from "@/components/DomainModal";
import { EconomiaModal, LS_KORE_EXPENSES, type ExpenseItem } from "@/components/EconomiaModal";
import { PerfilModal, type PerfilNavigateTipo, type PerfilUsuario } from "@/components/PerfilModal";
import { SaludResumenModal } from "@/components/SaludResumenModal";
import { LS_KORE_SALUD, SaludModal, type SaludData } from "@/components/SaludModal";
import {
  CalendarModal,
  type CalendarEventDraft,
  type CalendarEventUpdateDraft,
  type KoreAgendaEvent,
} from "@/components/CalendarModal/CalendarModal";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DomainHistoryEntry } from "@/components/DomainModal";
import {
  addCalendarEvent,
  addDomainHistory,
  ANDER_ID,
  deleteCalendarEvent,
  getCalendarEvents,
  getDomainHistory,
  getDomains,
  getExpenses,
  getHealthRecords,
  getProfiles,
  LEIRE_ID,
  updateCalendarEvent,
  updateDomain,
  updateStressLevel,
  type CalendarEventRow,
  type Domain as KoreDomainRow,
  type Expense,
} from "@/lib/kore-db";
import { useKoreRealtime } from "@/lib/kore-realtime";
import { saludFromHealthRecords } from "@/lib/kore-salud-sync";

const LS_KORE_AGENDA = "kore_calendar_events";
const LS_KORE_DOMAINS = "kore_domains_state";
const LS_KORE_STRESS_ANDER = "kore_stress_ander";
const LS_KORE_STRESS_LEIRE = "kore_stress_leire";

/** Usuario activo (hardcodeado hasta auth). */
const CURRENT_USER_ID = "00000000-0000-0000-0000-000000000001";

function readStressFromLs(key: string): number {
  if (typeof window === "undefined") return 5;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return 5;
    const n = Number(raw);
    if (Number.isNaN(n)) return 5;
    return Math.min(10, Math.max(1, Math.round(n)));
  } catch {
    return 5;
  }
}

function avatarStressBorder(level: number): string {
  if (level >= 8) return "#10b981";
  if (level >= 4) return "#f59e0b";
  return "#E05555";
}

function avatarStressShadow(level: number): string {
  if (level >= 8) return "0 0 12px rgba(16, 185, 129, 0.3)";
  if (level >= 4) return "0 0 12px rgba(245, 158, 11, 0.3)";
  return "0 0 12px rgba(224, 85, 85, 0.35)";
}

function stressThermometerColor(level: number): string {
  if (level >= 8) return "#4CC9A0";
  if (level >= 4) return "#EF9F27";
  return "#E05555";
}

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

function readExpensesFromLs(): ExpenseItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KORE_EXPENSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExpenseItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readSaludFromLs(): SaludData {
  if (typeof window === "undefined") return { Peque: { citas: [], medicaciones: [] }, Ander: { citas: [], medicaciones: [] }, Leire: { citas: [], medicaciones: [] } };
  try {
    const raw = localStorage.getItem(LS_KORE_SALUD);
    if (!raw) return { Peque: { citas: [], medicaciones: [] }, Ander: { citas: [], medicaciones: [] }, Leire: { citas: [], medicaciones: [] } };
    const parsed = JSON.parse(raw) as SaludData;
    if (!parsed?.Peque || !parsed?.Ander || !parsed?.Leire) return { Peque: { citas: [], medicaciones: [] }, Ander: { citas: [], medicaciones: [] }, Leire: { citas: [], medicaciones: [] } };
    return parsed;
  } catch {
    return { Peque: { citas: [], medicaciones: [] }, Ander: { citas: [], medicaciones: [] }, Leire: { citas: [], medicaciones: [] } };
  }
}

const C = {
  bg: "#090b10",
  card: "#161a22",
  text: "#e4e6ed",
  muted: "rgba(228, 230, 237, 0.45)",
  label: "rgba(228, 230, 237, 0.45)",
  border: "0.5px solid rgba(255, 255, 255, 0.07)",
  green: "#4CC9A0",
  purple: "#9B8FE8",
  amber: "#EF9F27",
  red: "#E05555",
} as const;

const sectionLabel: CSSProperties = {
  fontSize: "10px",
  fontFamily: "ui-monospace, monospace",
  letterSpacing: "2px",
  textTransform: "uppercase",
  fontWeight: 600,
  color: C.label,
  margin: "0 16px 14px",
};

const cardShell: CSSProperties = {
  background: C.card,
  border: C.border,
  borderRadius: "14px",
  padding: "14px",
  margin: "16px",
  color: C.text,
};

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

function formatMesAnioEs(d: Date) {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
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

  const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
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
  id: string;
  name: string;
  owner: string;
  weight: number;
  emoji: string;
  state: string;
  line: string;
  agent?: string;
  notes?: string[];
};

const DOMAINS: DomainCard[] = [
  { id: "menu", name: "Menú", owner: "Ander", weight: 8, emoji: "🍽️", state: "En curso", line: "#4CC9A0", notes: ["Revisar nevera"] },
  { id: "sueno", name: "Sueño", owner: "Leire", weight: 15, emoji: "😴", state: "Prioritario", line: "#9B8FE8", notes: ["Acostar antes de 23:00"] },
  { id: "limpieza", name: "Limpieza", owner: "Leire", weight: 5, emoji: "🧹", state: "OK", line: "#EF9F27", notes: ["Baño principal"] },
  { id: "compras", name: "Compras", owner: "Ander", weight: 4, emoji: "🛒", state: "Pendiente", line: "#4CC9A0", notes: ["Falta fruta"] },
  {
    id: "colegio",
    name: "Colegio",
    owner: "Leire",
    weight: 6,
    emoji: "🎒",
    state: "Excursión 15 mayo",
    line: "#7F77DD",
    agent: "logistica",
    notes: ["Firmar autorización"],
  },
  {
    id: "tiempo-libre",
    name: "Tiempo Libre",
    owner: "Sin asignar",
    weight: 7,
    emoji: "🌿",
    state: "Cada uno tiene su espacio",
    line: "#4CC9A0",
    agent: "armonia",
    notes: [],
  },
];

const CORCHO_MESSAGES = [
  { who: "Leire", avatar: "L", ownerColor: "#f59e0b", text: "Te dejo un audio sobre la reunión del cole.", when: "Hace 12 min" },
  { who: "Ander", avatar: "A", ownerColor: "#10b981", text: "¿Puedes recoger pan antes de las 19:00?", when: "Ayer 21:40" },
  { who: "Leire", avatar: "L", ownerColor: "#f59e0b", text: "Mañana revisamos menú de la semana.", when: "Ayer 20:15" },
];

function readDomainsFromLs(): DomainCard[] {
  if (typeof window === "undefined") return DOMAINS;
  try {
    const raw = localStorage.getItem(LS_KORE_DOMAINS);
    if (!raw) return DOMAINS;
    const parsed = JSON.parse(raw) as DomainCard[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DOMAINS;
    return parsed;
  } catch {
    return DOMAINS;
  }
}

function calendarRowToEvent(row: CalendarEventRow): KoreAgendaEvent {
  return {
    id: row.id,
    titulo: row.title,
    fecha: (row.date ?? "").slice(0, 10),
    hora: (row.time ?? "").trim() ? row.time : null,
  };
}

function mapExpenseRowToItem(row: Expense): ExpenseItem {
  const allowed: ExpenseItem["category"][] = ["comida", "hogar", "salud", "ocio", "transporte", "otros"];
  const category = (allowed.includes(row.category as ExpenseItem["category"])
    ? row.category
    : "otros") as ExpenseItem["category"];
  return {
    id: row.id,
    desc: row.description,
    amount: row.amount,
    category,
    paidBy: row.payer_id === LEIRE_ID ? "Leire" : "Ander",
    shared: row.is_shared,
    at: row.created_at,
  };
}

function mergedDomainCard(row: KoreDomainRow): DomainCard {
  const def = DOMAINS.find((d) => d.name === row.name);
  const owner =
    row.owner_id === ANDER_ID ? "Ander" : row.owner_id === LEIRE_ID ? "Leire" : "Sin asignar";
  return {
    id: row.id,
    name: row.name,
    owner,
    weight: row.weight,
    emoji: def?.emoji ?? "📌",
    state: def?.state ?? "—",
    line: def?.line ?? "#4CC9A0",
    agent: row.agent ?? def?.agent,
    notes: def?.notes ?? [],
  };
}

export default function Home() {
  const [showAgent, setShowAgent] = useState(false);
  const [showCorcho, setShowCorcho] = useState(false);
  const [showCorchoHistorial, setShowCorchoHistorial] = useState(false);
  const [showEconomia, setShowEconomia] = useState(false);
  const [showSalud, setShowSalud] = useState(false);
  const [showSaludResumen, setShowSaludResumen] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [usuarioPerfil, setUsuarioPerfil] = useState<PerfilUsuario>("Ander");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | null>(null);
  const [agendaEvents, setAgendaEvents] = useState<KoreAgendaEvent[]>([]);

  const [domainsOpen, setDomainsOpen] = useState(true);
  const [domains, setDomains] = useState<DomainCard[]>(DOMAINS);
  const [activeDomainName, setActiveDomainName] = useState<string | null>(null);
  const [domainHistoryList, setDomainHistoryList] = useState<DomainHistoryEntry[]>([]);
  const [healthOpen, setHealthOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [salud, setSalud] = useState<SaludData>({
    Peque: { citas: [], medicaciones: [] },
    Ander: { citas: [], medicaciones: [] },
    Leire: { citas: [], medicaciones: [] },
  });
  const [anderStress, setAnderStress] = useState(5);
  const [leireStress, setLeireStress] = useState(5);

  const loadProfiles = useCallback(async () => {
    try {
      const profiles = await getProfiles();
      const a = profiles.find((p) => p.id === ANDER_ID);
      const l = profiles.find((p) => p.id === LEIRE_ID);
      if (a) setAnderStress(Math.min(10, Math.max(1, Math.round(a.stress_level))));
      if (l) setLeireStress(Math.min(10, Math.max(1, Math.round(l.stress_level))));
      try {
        if (a) localStorage.setItem(LS_KORE_STRESS_ANDER, String(a.stress_level));
        if (l) localStorage.setItem(LS_KORE_STRESS_LEIRE, String(l.stress_level));
      } catch {
        /* ignore */
      }
    } catch {
      setAnderStress(readStressFromLs(LS_KORE_STRESS_ANDER));
      setLeireStress(readStressFromLs(LS_KORE_STRESS_LEIRE));
    }
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      const rows = await getDomains();
      const mapped = rows.map(mergedDomainCard);
      setDomains(mapped);
      try {
        localStorage.setItem(LS_KORE_DOMAINS, JSON.stringify(mapped));
      } catch {
        /* ignore */
      }
    } catch {
      setDomains(readDomainsFromLs());
    }
  }, []);

  const loadAgenda = useCallback(async () => {
    try {
      const rows = await getCalendarEvents();
      const mapped = rows.map(calendarRowToEvent);
      setAgendaEvents(mapped);
      try {
        localStorage.setItem(LS_KORE_AGENDA, JSON.stringify(mapped));
      } catch {
        /* ignore */
      }
    } catch {
      setAgendaEvents(readAgendaFromLs());
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      const rows = await getExpenses();
      const mapped = rows.map(mapExpenseRowToItem).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setExpenses(mapped);
    } catch {
      setExpenses(readExpensesFromLs());
    }
  }, []);

  const loadSalud = useCallback(async () => {
    try {
      const rows = await getHealthRecords();
      setSalud(saludFromHealthRecords(rows) as SaludData);
    } catch {
      setSalud(readSaludFromLs());
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void Promise.all([loadProfiles(), loadDomains(), loadAgenda(), loadExpenses(), loadSalud()]);
    });
  }, [loadAgenda, loadDomains, loadExpenses, loadProfiles, loadSalud]);

  useKoreRealtime(
    useCallback(
      (table) => {
        queueMicrotask(() => {
          if (table === "domains") void loadDomains();
          else if (table === "calendar_events") void loadAgenda();
          else if (table === "expenses") void loadExpenses();
          else if (table === "health_records") void loadSalud();
          else if (table === "profiles") void loadProfiles();
        });
      },
      [loadAgenda, loadDomains, loadExpenses, loadProfiles, loadSalud],
    ),
  );

  useEffect(() => {
    if (!activeDomainName) {
      setDomainHistoryList([]);
      return;
    }
    const d = domains.find((x) => x.name === activeDomainName);
    if (!d) {
      setDomainHistoryList([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getDomainHistory(d.id);
        if (cancelled) return;
        setDomainHistoryList(rows.map((r) => ({ id: r.id, at: r.created_at, text: r.text })));
      } catch {
        if (!cancelled) setDomainHistoryList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDomainName, domains]);

  const weekDays = useMemo(() => buildWeekDays(new Date(), agendaEvents), [agendaEvents]);
  const agendaMonthYear = useMemo(() => formatMesAnioEs(new Date()), []);
  const activeDomain = useMemo(
    () => (activeDomainName ? domains.find((d) => d.name === activeDomainName) ?? null : null),
    [activeDomainName, domains],
  );
  const economia = useMemo(() => {
    const now = new Date();
    const monthItems = expenses.filter((it) => {
      const d = new Date(it.at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const totalMes = monthItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const sharedItems = expenses.filter((it) => it.shared);
    const totalShared = sharedItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const paidAnder = sharedItems
      .filter((it) => it.paidBy === "Ander")
      .reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const paidLeire = sharedItems
      .filter((it) => it.paidBy === "Leire")
      .reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const half = totalShared / 2;
    return {
      totalMes,
      debeAnder: Math.max(0, half - paidAnder),
      debeLeire: Math.max(0, half - paidLeire),
    };
  }, [expenses]);
  const saludPendientes = useMemo(
    () =>
      salud.Peque.citas.length +
      salud.Peque.medicaciones.length +
      salud.Ander.citas.length +
      salud.Ander.medicaciones.length +
      salud.Leire.citas.length +
      salud.Leire.medicaciones.length,
    [salud],
  );

  const sortAgendaEvents = useCallback((list: KoreAgendaEvent[]) => {
    return [...list].sort((a, b) => {
      const da = (a.fecha ?? "").localeCompare(b.fecha ?? "");
      if (da !== 0) return da;
      return (a.hora ?? "").localeCompare(b.hora ?? "");
    });
  }, []);

  const persistAgendaLs = useCallback((next: KoreAgendaEvent[]) => {
    try {
      localStorage.setItem(LS_KORE_AGENDA, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const handleCalendarAddEvent = useCallback(
    async (draft: CalendarEventDraft) => {
      try {
        const row = await addCalendarEvent({
          title: draft.titulo,
          date: draft.fecha,
          time: draft.hora?.trim().length ? draft.hora : "",
          created_by: CURRENT_USER_ID,
        });
        const ev = calendarRowToEvent(row);
        setAgendaEvents((prev) => {
          const next = sortAgendaEvents([...prev, ev]);
          persistAgendaLs(next);
          return next;
        });
        return ev;
      } catch {
        const ev: KoreAgendaEvent = {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ev_${Date.now()}`,
          titulo: draft.titulo,
          fecha: draft.fecha,
          hora: draft.hora?.trim().length ? draft.hora : null,
        };
        setAgendaEvents((prev) => {
          const next = sortAgendaEvents([...prev, ev]);
          persistAgendaLs(next);
          return next;
        });
        return ev;
      }
    },
    [persistAgendaLs, sortAgendaEvents],
  );

  const handleCalendarUpdateEvent = useCallback(
    async (id: string, draft: CalendarEventUpdateDraft) => {
      const ev = agendaEvents.find((e) => e.id === id);
      const fecha = (ev?.fecha ?? "").slice(0, 10);
      const nextLocal = (prev: KoreAgendaEvent[]) =>
        prev.map((e) =>
          e.id === id ? { ...e, titulo: draft.titulo, hora: draft.hora?.trim().length ? draft.hora : null } : e,
        );
      try {
        await updateCalendarEvent(id, {
          title: draft.titulo,
          date: fecha,
          time: draft.hora?.trim().length ? draft.hora! : "",
        });
        setAgendaEvents((prev) => {
          const next = nextLocal(prev);
          persistAgendaLs(next);
          return next;
        });
      } catch {
        setAgendaEvents((prev) => {
          const next = nextLocal(prev);
          persistAgendaLs(next);
          return next;
        });
      }
    },
    [agendaEvents, persistAgendaLs],
  );

  const handleCalendarDeleteEvent = useCallback(
    async (id: string) => {
      try {
        await deleteCalendarEvent(id);
      } catch {
        return;
      }
      setAgendaEvents((prev) => {
        const next = prev.filter((e) => e.id !== id);
        persistAgendaLs(next);
        return next;
      });
    },
    [persistAgendaLs],
  );

  const handleSaveDomain = async (next: Pick<DomainItem, "owner" | "state" | "notes">) => {
    if (!activeDomainName) return;
    const current = domains.find((d) => d.name === activeDomainName);
    if (!current) return;
    const owner_id =
      next.owner === "Ander" ? ANDER_ID : next.owner === "Leire" ? LEIRE_ID : null;
    const histText = `Owner: ${next.owner} · Estado: ${next.state || "Sin estado"}${
      next.notes.length ? ` · Nota: ${next.notes[next.notes.length - 1]}` : ""
    }`;
    try {
      await updateDomain(current.id, { owner_id });
      await addDomainHistory(current.id, histText, CURRENT_USER_ID);
      const updated = domains.map((d) =>
        d.name === activeDomainName ? { ...d, owner: next.owner, state: next.state, notes: next.notes } : d,
      );
      setDomains(updated);
      try {
        localStorage.setItem(LS_KORE_DOMAINS, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      const rows = await getDomainHistory(current.id);
      setDomainHistoryList(rows.map((r) => ({ id: r.id, at: r.created_at, text: r.text })));
    } catch {
      const updated = domains.map((d) =>
        d.name === activeDomainName ? { ...d, owner: next.owner, state: next.state, notes: next.notes } : d,
      );
      setDomains(updated);
      try {
        localStorage.setItem(LS_KORE_DOMAINS, JSON.stringify(updated));
        const key = `kore_domain_history_${current.id}`;
        const raw = localStorage.getItem(key);
        const list = raw ? (JSON.parse(raw) as Array<{ id: string; at: string; text: string }>) : [];
        const entry = {
          id: crypto.randomUUID?.() ?? `hist_${Date.now()}`,
          at: new Date().toISOString(),
          text: histText,
        };
        localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), entry]));
      } catch {
        /* ignore */
      }
    }
    setActiveDomainName(null);
  };

  /** Cierra el perfil y abre el destino (dominio vía `activeDomainName`; salud → resumen). */
  const handlePerfilNavigate = (tipo: PerfilNavigateTipo, id: string) => {
    setShowPerfil(false);
    if (tipo === "domain") {
      const selectedDomain = domains.find((d) => d.id === id);
      if (selectedDomain) {
        setActiveDomainName(selectedDomain.name);
      }
    }
    if (tipo === "salud") {
      setShowSaludResumen(true);
    }
  };

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
          <svg width="40" height="40" viewBox="0 0 160 160" fill="none" aria-hidden style={{ flexShrink: 0 }}>
            <rect width="160" height="160" rx="36" fill="#0b0d13" />
            <circle cx="68" cy="80" r="36" stroke="#4CC9A0" strokeWidth="1.8" fill="none" />
            <circle cx="96" cy="80" r="36" stroke="#9B8FE8" strokeWidth="1.8" fill="none" />
            <circle cx="82" cy="80" r="7" fill="white" opacity="0.95" />
            <circle cx="82" cy="80" r="14" fill="white" opacity="0.05" />
          </svg>
          <p
            style={{
              margin: 0,
              fontSize: 26,
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
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 4px",
            gap: 2,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(228, 230, 237, 0.45)",
              letterSpacing: "2px",
              textAlign: "center",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Dopico
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontFamily: "ui-monospace, monospace",
              color: "rgba(228, 230, 237, 0.45)",
              letterSpacing: "2px",
              textAlign: "center",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Gómez
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
          <button
            type="button"
            aria-label="Perfil de Ander"
            onClick={() => {
              setUsuarioPerfil("Ander");
              setShowPerfil(true);
            }}
            style={{
              ...avatarBase,
              position: "relative",
              zIndex: 1,
              borderColor: avatarStressBorder(anderStress),
              boxShadow: avatarStressShadow(anderStress),
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            A
          </button>
          <button
            type="button"
            aria-label="Perfil de Leire"
            onClick={() => {
              setUsuarioPerfil("Leire");
              setShowPerfil(true);
            }}
            style={{
              ...avatarBase,
              position: "relative",
              zIndex: 2,
              borderColor: avatarStressBorder(leireStress),
              boxShadow: avatarStressShadow(leireStress),
              marginLeft: -10,
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            L
          </button>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          width: "100%",
          margin: 0,
          paddingTop: 96,
          paddingBottom: 120,
          boxSizing: "border-box",
        }}
      >
        {/* Agenda */}
        <section>
          <p style={{ ...sectionLabel }}>Agenda familiar</p>
          <div
            style={{
              margin: 0,
              padding: "0 20px",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#e4e6ed",
                minWidth: 0,
              }}
            >
              {agendaMonthYear}
            </p>
            <button
              type="button"
              onClick={() => {
                setCalendarInitialDate(null);
                setShowCalendar(true);
              }}
              style={{
                margin: 0,
                padding: 0,
                border: "none",
                background: "transparent",
                fontSize: "11px",
                color: "rgba(76,201,160,0.6)",
                fontFamily: "monospace",
                letterSpacing: "1px",
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Ver calendario →
            </button>
          </div>
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
                aria-current={day.isToday ? "date" : undefined}
                onClick={() => {
                  setCalendarInitialDate(day.date);
                  setShowCalendar(true);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  background: day.isToday ? "rgba(76, 201, 160, 0.12)" : "#161a22",
                  border: day.isToday
                    ? "1.5px solid rgba(76, 201, 160, 0.55)"
                    : "0.5px solid rgba(255, 255, 255, 0.07)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  minWidth: 65,
                  flexShrink: 0,
                  boxSizing: "border-box",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                  boxShadow: day.isToday ? "0 0 16px rgba(76, 201, 160, 0.2)" : undefined,
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: day.isToday ? 700 : 500,
                    letterSpacing: "0.02em",
                    color: day.isToday ? C.green : C.muted,
                  }}
                >
                  {day.label}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: day.isToday ? C.green : C.text,
                  }}
                >
                  {day.num}
                </span>
                <div
                  style={{
                    minHeight: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {day.isToday ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: C.green,
                      }}
                    >
                      Hoy
                    </span>
                  ) : null}
                </div>
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
                {domains.slice(0, 4).map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setActiveDomainName(d.name)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                      textAlign: "left",
                      color: C.text,
                      cursor: "pointer",
                      font: "inherit",
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
                      {d.notes && d.notes.length > 0 ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 11,
                            color: C.muted,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {d.notes[d.notes.length - 1]}
                        </p>
                      ) : null}
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
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {domains.slice(4).map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setActiveDomainName(d.name)}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                      width: "100%",
                      textAlign: "left",
                      color: C.text,
                      cursor: "pointer",
                      font: "inherit",
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
                      {d.notes && d.notes.length > 0 ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 11,
                            color: C.muted,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {d.notes[d.notes.length - 1]}
                        </p>
                      ) : null}
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
                  </button>
                ))}
              </div>
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
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 12,
              padding: 14,
              textAlign: "left",
              color: C.text,
            }}
          >
            <button
              type="button"
              onClick={() => setShowSalud(true)}
              style={{
                display: "flex",
                flex: 1,
                minWidth: 0,
                alignItems: "center",
                gap: 12,
                background: "none",
                border: "none",
                color: "inherit",
                textAlign: "left",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              <span style={{ fontSize: 24 }} aria-hidden>
                🏥
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Salud familiar</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Citas y medicación</p>
              </div>
            </button>
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
              {saludPendientes} pendientes
            </span>
            <button
              type="button"
              onClick={() => setHealthOpen((o) => !o)}
              aria-label={healthOpen ? "Contraer salud" : "Expandir salud"}
              style={{
                border: "none",
                background: "transparent",
                color: C.muted,
                cursor: "pointer",
                padding: 0,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              {healthOpen ? "▼" : "▶"}
            </button>
          </div>

          {healthOpen ? (
            <div
              style={{
                borderTop: "0.5px solid rgba(255,255,255,0.07)",
                padding: "12px 14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {(["Peque", "Ander", "Leire"] as const).map((member) => {
                const citas = salud[member].citas;
                const meds = salud[member].medicaciones;
                return (
                  <div
                    key={member}
                    onClick={() => setShowSaludResumen(true)}
                    style={{ cursor: "pointer" }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: member === "Peque" ? C.green : member === "Leire" ? C.amber : C.muted,
                      }}
                    >
                      {member}
                    </p>
                    {citas.length === 0 && meds.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Sin registros</p>
                    ) : (
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {citas.map((c) => (
                          <li
                            key={c.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              borderLeft: `2px solid ${C.purple}`,
                              paddingLeft: 8,
                              fontSize: 13,
                              color: C.text,
                            }}
                          >
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.fecha} {c.hora} · {c.descripcion}
                            </span>
                          </li>
                        ))}
                        {meds.map((m) => {
                          const dt = m.proximaToma;
                          const [f, t] = dt.includes("T") ? dt.split("T") : [dt, ""];
                          return (
                            <li
                              key={m.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                borderLeft: `2px solid ${C.green}`,
                                paddingLeft: 8,
                                fontSize: 13,
                                color: C.text,
                              }}
                            >
                              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {f} {t} · {m.nombre} ({m.dosis})
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* El corcho */}
        <section>
          <p style={{ ...sectionLabel }}>El corcho</p>
          <button
            type="button"
            onClick={() => {
              setShowAgent(false);
              setShowCorcho(false);
              setShowCorchoHistorial(true);
            }}
            style={{
              width: "calc(100% - 32px)",
              margin: "0 16px 16px",
              padding: 0,
              border: "none",
              background: "transparent",
              textAlign: "left",
              cursor: "pointer",
              color: C.text,
              font: "inherit",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {CORCHO_MESSAGES.slice(-3).map((msg, idx) => (
                <div
                  key={`${msg.who}-${idx}`}
                  style={{
                    background: "#161a22",
                    border: "0.5px solid rgba(255,255,255,0.07)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      ...avatarBase,
                      width: 30,
                      height: 30,
                      fontSize: 11,
                      flexShrink: 0,
                      borderColor: msg.ownerColor,
                      background: "#12151c",
                    }}
                  >
                    {msg.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: C.text, fontSize: 11 }}>{msg.who}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text, opacity: 0.95 }}>{msg.text}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>{msg.when}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: "8px 4px 0", fontSize: 11, color: "var(--muted)" }}>Ver historial completo →</p>
          </button>
        </section>

        {/* Economía */}
        <button
          type="button"
          onClick={() => setShowEconomia(true)}
          style={{
            ...cardShell,
            display: "block",
            width: "calc(100% - 32px)",
            textAlign: "left",
            cursor: "pointer",
            color: C.text,
            font: "inherit",
          }}
        >
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
              <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 700, color: C.red }}>
                -{economia.totalMes.toFixed(2).replace(".", ",")}€
              </p>
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
              <p style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 700, color: C.green }}>
                +{economia.debeAnder.toFixed(2).replace(".", ",")}€
              </p>
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {expenses.slice(0, 3).map((e) => (
              <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
                <span style={{ fontSize: 20 }}>{e.category === "comida" ? "🍽️" : e.category === "hogar" ? "🏠" : e.category === "salud" ? "🏥" : e.category === "ocio" ? "🎯" : e.category === "transporte" ? "🚗" : "🧾"}</span>
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
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                    {new Date(e.at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <span style={{ flexShrink: 0, fontFamily: "ui-monospace, monospace", color: C.red }}>
                  -{Math.abs(e.amount).toFixed(2).replace(".", ",")}€
                </span>
              </li>
            ))}
          </ul>
        </button>

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
              onClick={() =>
                setAnderStress((n) => {
                  const next = n >= 10 ? 1 : n + 1;
                  try {
                    localStorage.setItem(LS_KORE_STRESS_ANDER, String(next));
                  } catch {
                    /* ignore */
                  }
                  return next;
                })
              }
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
                    background: stressThermometerColor(anderStress),
                    width: `${(anderStress / 10) * 100}%`,
                  }}
                />
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                setLeireStress((n) => {
                  const next = n >= 10 ? 1 : n + 1;
                  try {
                    localStorage.setItem(LS_KORE_STRESS_LEIRE, String(next));
                  } catch {
                    /* ignore */
                  }
                  return next;
                })
              }
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
                    background: stressThermometerColor(leireStress),
                    width: `${(leireStress / 10) * 100}%`,
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
          onClick={() => {
            setShowAgent(false);
            setShowCorchoHistorial(false);
            setShowCorcho(true);
          }}
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
          onClick={() => {
            setShowCorcho(false);
            setShowCorchoHistorial(false);
            setShowAgent(true);
          }}
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

      {showCorcho ? <CorchoChat onClose={() => setShowCorcho(false)} /> : null}
      {showCorchoHistorial ? <CorchoHistorial onClose={() => setShowCorchoHistorial(false)} /> : null}
      {showAgent ? <AgentChat onClose={() => setShowAgent(false)} /> : null}
      {showEconomia ? (
        <EconomiaModal
          onClose={() => setShowEconomia(false)}
          onChange={(items) => setExpenses(items)}
        />
      ) : null}
      {showSalud ? (
        <SaludModal
          onClose={() => setShowSalud(false)}
          onChange={(next) => setSalud(next)}
        />
      ) : null}
      {showSaludResumen ? (
        <SaludResumenModal
          onClose={() => setShowSaludResumen(false)}
          onChange={(next) => setSalud(next)}
        />
      ) : null}
      {showPerfil ? (
        <PerfilModal
          usuario={usuarioPerfil}
          onClose={() => setShowPerfil(false)}
          domains={domains}
          saludMember={salud[usuarioPerfil]}
          stressLevel={usuarioPerfil === "Ander" ? anderStress : leireStress}
          onStressChange={(n) => {
            const perfil = usuarioPerfil;
            const uid = perfil === "Ander" ? ANDER_ID : LEIRE_ID;
            const persistLs = () => {
              try {
                localStorage.setItem(
                  perfil === "Ander" ? LS_KORE_STRESS_ANDER : LS_KORE_STRESS_LEIRE,
                  String(n),
                );
              } catch {
                /* ignore */
              }
            };
            void (async () => {
              try {
                await updateStressLevel(uid, n);
              } catch {
                /* Supabase no disponible: mismo estado local + LS */
              }
              if (perfil === "Ander") setAnderStress(n);
              else setLeireStress(n);
              persistLs();
            })();
          }}
          onNavigate={handlePerfilNavigate}
        />
      ) : null}
      {activeDomain ? (
        <DomainModal
          domain={{
            id: activeDomain.id,
            name: activeDomain.name,
            owner: activeDomain.owner,
            state: activeDomain.state,
            emoji: activeDomain.emoji,
            notes: activeDomain.notes ?? [],
          }}
          onClose={() => setActiveDomainName(null)}
          onSave={handleSaveDomain}
          historyEntries={domainHistoryList}
          historyReadOnly
        />
      ) : null}

      {showCalendar ? (
        <CalendarModal
          onClose={() => {
            setShowCalendar(false);
            setCalendarInitialDate(null);
          }}
          events={agendaEvents}
          initialDate={calendarInitialDate}
          onAddEvent={handleCalendarAddEvent}
          onUpdateEvent={handleCalendarUpdateEvent}
          onDeleteEvent={handleCalendarDeleteEvent}
        />
      ) : null}
      </div>
    </div>
  );
}

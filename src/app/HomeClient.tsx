"use client";

import { AgentChat } from "@/components/AgentChat/AgentChat";
import { CorchoChat } from "@/components/CorchoChat";
import { CorchoHistorial } from "@/components/CorchoHistorial";
import { DomainModal, type DomainItem } from "@/components/DomainModal";
import { EconomiaModal, type ExpenseItem } from "@/components/EconomiaModal";
import { PerfilModal, type PerfilNavigateTipo, type PerfilUsuario } from "@/components/PerfilModal";
import { SaludResumenModal } from "@/components/SaludResumenModal";
import { SaludModal, type SaludData } from "@/components/SaludModal";
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
  getKoreNotes,
  getPendingCleaningTasks,
  getProfiles,
  getShoppingItems,
  getSleepLogs,
  getWeeklyMenu,
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
import { emitKoreUpdate, onKoreUpdate } from "@/lib/kore-events";

/** Usuario activo (hardcodeado hasta auth). */
const CURRENT_USER_ID = "00000000-0000-0000-0000-000000000001";

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

const SKEL = {
  bg: "rgba(255, 255, 255, 0.06)",
  fg: "rgba(255, 255, 255, 0.12)",
  line: "rgba(255, 255, 255, 0.08)",
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

const CORCHO_MESSAGES: CorchoMessage[] = [
  { who: "Leire", avatar: "L", ownerColor: "#f59e0b", text: "Te dejo un audio sobre la reunión del cole.", when: "Hace 12 min" },
  { who: "Ander", avatar: "A", ownerColor: "#10b981", text: "¿Puedes recoger pan antes de las 19:00?", when: "Ayer 21:40" },
  { who: "Leire", avatar: "L", ownerColor: "#f59e0b", text: "Mañana revisamos menú de la semana.", when: "Ayer 20:15" },
];

type CorchoMessage = {
  who: "Ander" | "Leire";
  avatar: "A" | "L";
  ownerColor: string;
  text: string;
  when: string;
};

type HomeClientProps = {
  initialCorchoMessages?: CorchoMessage[];
};

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
    state: def?.state ?? "Sin actividad",
    line: def?.line ?? "#4CC9A0",
    agent: row.agent ?? def?.agent,
    notes: def?.notes ?? [],
  };
}

function mergeDomainsWithFallback(primary: DomainCard[], fallback: DomainCard[]): DomainCard[] {
  const normalizeDomainKey = (name: string) => name.trim().toLowerCase();
  const byName = new Map(primary.map((d) => [normalizeDomainKey(d.name), d]));
  const merged = fallback.map((base) => {
    const fromDb = byName.get(normalizeDomainKey(base.name));
    if (!fromDb) return base;
    return {
      ...base,
      ...fromDb,
      emoji: fromDb.emoji || base.emoji,
      line: fromDb.line || base.line,
      state: fromDb.state || base.state,
      notes: fromDb.notes && fromDb.notes.length > 0 ? fromDb.notes : base.notes,
    };
  });
  return merged;
}

function enrichComprasDomainFromShoppingItems(domain: DomainCard, items: Awaited<ReturnType<typeof getShoppingItems>>): DomainCard {
  if (domain.name.toLowerCase() !== "compras") return domain;
  const normalized = items
    .map((item) => ({
      name: (item.name ?? "").trim(),
      quantity: (item.quantity ?? "").trim(),
      completed: Boolean(item.completed),
      createdAtMs: new Date(item.created_at).getTime(),
    }))
    .filter((item) => item.name.length > 0)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const pending = normalized.filter((item) => !item.completed);
  const notes = normalized.slice(0, 3).map((item) => (item.quantity ? `${item.name} (${item.quantity})` : item.name));
  const state =
    pending.length > 0
      ? `${pending.length} item${pending.length === 1 ? "" : "s"} pendiente${pending.length === 1 ? "" : "s"}`
      : normalized.length > 0
        ? "Todo comprado"
        : domain.state;
  return { ...domain, state, notes: notes.length > 0 ? notes : domain.notes };
}

function enrichMenuDomain(domain: DomainCard, rows: Awaited<ReturnType<typeof getWeeklyMenu>>): DomainCard {
  if (domain.name !== "Menú") return domain;
  const notes = rows.slice(0, 3).map((r) => `${r.day}: ${r.dish}`);
  return {
    ...domain,
    state: rows.length > 0 ? `${rows.length} comidas planificadas` : "Sin menú esta semana",
    notes,
  };
}

function enrichLimpiezaDomain(domain: DomainCard, rows: Awaited<ReturnType<typeof getPendingCleaningTasks>>): DomainCard {
  if (domain.name !== "Limpieza") return domain;
  const notes = rows.slice(0, 3).map((r) => `${r.zone}: ${r.task}`);
  return {
    ...domain,
    state: rows.length > 0 ? `${rows.length} tareas pendientes` : "Sin tareas pendientes",
    notes,
  };
}

function enrichSuenoDomain(domain: DomainCard, rows: Awaited<ReturnType<typeof getSleepLogs>>): DomainCard {
  if (domain.name !== "Sueño") return domain;
  const notes = rows.slice(0, 3).map((r) => {
    const detail = r.type === "sleep_hours" && r.hours != null ? `${r.hours}h` : r.reason ?? r.type;
    return `${r.person}: ${detail}`;
  });
  return {
    ...domain,
    state: rows.length > 0 ? `Últimos registros: ${rows.length}` : "Sin registros recientes",
    notes,
  };
}

function withinAgendaWindow(dateIso: string, now = new Date()): boolean {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 30);
  const d = new Date(`${dateIso}T00:00:00`);
  return d >= from && d <= to;
}

export function HomeClient({ initialCorchoMessages = [] }: HomeClientProps) {
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
  const [booting, setBooting] = useState(true);

  const [domainsOpen, setDomainsOpen] = useState(true);
  const [domainCardHover, setDomainCardHover] = useState<Record<string, boolean>>({});
  const [domains, setDomains] = useState<DomainCard[]>(DOMAINS);
  const [corchoMessages, setCorchoMessages] = useState<CorchoMessage[]>(
    initialCorchoMessages.length > 0 ? initialCorchoMessages : [],
  );
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
    } catch {
      setAnderStress(5);
      setLeireStress(5);
    }
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      const [rows, shoppingItems, cleaningTasks, weeklyMenu, sleepLogs] = await Promise.all([
        getDomains(),
        getShoppingItems(),
        getPendingCleaningTasks(),
        getWeeklyMenu(),
        getSleepLogs(7),
      ]);
      const mapped = rows.map((row) =>
        enrichSuenoDomain(
          enrichLimpiezaDomain(
            enrichMenuDomain(enrichComprasDomainFromShoppingItems(mergedDomainCard(row), shoppingItems), weeklyMenu),
            cleaningTasks,
          ),
          sleepLogs,
        ),
      );
      setDomains(mergeDomainsWithFallback(mapped, DOMAINS));
    } catch {
      setDomains(DOMAINS);
    }
  }, []);

  const loadAgenda = useCallback(async () => {
    try {
      const rows = await getCalendarEvents();
      const mapped = rows
        .filter((row) => withinAgendaWindow((row.date ?? "").slice(0, 10)))
        .map(calendarRowToEvent);
      setAgendaEvents(mapped);
    } catch {
      setAgendaEvents([]);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      const rows = await getExpenses();
      const mapped = rows.map(mapExpenseRowToItem).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setExpenses(mapped);
    } catch {
      setExpenses([]);
    }
  }, []);

  const loadSalud = useCallback(async () => {
    try {
      const rows = await getHealthRecords();
      const filtered = rows.filter((r) => {
        const active = r.status === "active" || r.status === "pending";
        if (!active) return false;
        if (r.type === "appointment") return Boolean((r.date_time ?? "").trim());
        if (r.type === "medication") return Boolean((r.next_dose_at ?? "").trim());
        return false;
      });
      setSalud(saludFromHealthRecords(filtered) as SaludData);
    } catch {
      setSalud({
        Peque: { citas: [], medicaciones: [] },
        Ander: { citas: [], medicaciones: [] },
        Leire: { citas: [], medicaciones: [] },
      });
    }
  }, []);

  const loadCorcho = useCallback(async () => {
    try {
      const rows = await getKoreNotes();
      const mapped: CorchoMessage[] = rows.slice(0, 3).map((r) => {
        const who = r.sender_id === LEIRE_ID ? "Leire" : "Ander";
        return {
          who,
          avatar: who === "Leire" ? "L" : "A",
          ownerColor: who === "Leire" ? "#f59e0b" : "#10b981",
          text: r.content ?? "(nota sin texto)",
          when: new Date(r.created_at).toLocaleString("es-ES"),
        };
      });
      setCorchoMessages(
        mapped.length > 0
          ? mapped
          : initialCorchoMessages.length > 0
            ? initialCorchoMessages
            : CORCHO_MESSAGES,
      );
    } catch {
      setCorchoMessages(initialCorchoMessages.length > 0 ? initialCorchoMessages : CORCHO_MESSAGES);
    }
  }, [initialCorchoMessages]);

  const handleCloseAgentChat = useCallback(() => {
    setShowAgent(false);
    queueMicrotask(() => {
      void loadAgenda();
    });
  }, [loadAgenda]);

  useEffect(() => {
    queueMicrotask(() => {
      void Promise.all([loadProfiles(), loadDomains(), loadAgenda(), loadExpenses(), loadSalud(), loadCorcho()]).finally(() => {
        setBooting(false);
      });
    });
  }, [loadAgenda, loadCorcho, loadDomains, loadExpenses, loadProfiles, loadSalud]);

  useKoreRealtime(
    useCallback(
      (table) => {
        queueMicrotask(() => {
          if (table === "domains") void loadDomains();
          else if (table === "shopping_items") void loadDomains();
          else if (table === "cleaning_tasks") void loadDomains();
          else if (table === "menu_items") void loadDomains();
          else if (table === "sleep_logs") void loadDomains();
          else if (table === "calendar_events") void loadAgenda();
          else if (table === "expenses") void loadExpenses();
          else if (table === "health_records") void loadSalud();
          else if (table === "kore_notes") void loadCorcho();
          else if (table === "profiles") void loadProfiles();
        });
      },
      [loadAgenda, loadCorcho, loadDomains, loadExpenses, loadProfiles, loadSalud],
    ),
  );

  useEffect(() => {
    return onKoreUpdate((tables) => {
      if (tables.includes("calendar_events")) void loadAgenda();
      if (tables.includes("health_records")) void loadSalud();
      if (tables.includes("expenses")) void loadExpenses();
      if (tables.includes("kore_notes")) void loadCorcho();
      if (tables.includes("domains")) void loadDomains();
      if (tables.includes("shopping_items")) void loadDomains();
      if (tables.includes("cleaning_tasks")) void loadDomains();
      if (tables.includes("menu_items")) void loadDomains();
      if (tables.includes("sleep_logs")) void loadDomains();
      if (tables.includes("profiles")) void loadProfiles();
    });
  }, [loadAgenda, loadCorcho, loadDomains, loadExpenses, loadProfiles, loadSalud]);

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
          return sortAgendaEvents([...prev, ev]);
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
          return sortAgendaEvents([...prev, ev]);
        });
        return ev;
      }
    },
    [sortAgendaEvents],
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
        setAgendaEvents((prev) => nextLocal(prev));
      } catch {
        setAgendaEvents((prev) => nextLocal(prev));
      }
    },
    [agendaEvents],
  );

  const handleCalendarDeleteEvent = useCallback(
    async (id: string) => {
      try {
        await deleteCalendarEvent(id);
      } catch {
        return;
      }
      setAgendaEvents((prev) => prev.filter((e) => e.id !== id));
    },
    [],
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
      const rows = await getDomainHistory(current.id);
      setDomainHistoryList(rows.map((r) => ({ id: r.id, at: r.created_at, text: r.text })));
    } catch {
      const updated = domains.map((d) =>
        d.name === activeDomainName ? { ...d, owner: next.owner, state: next.state, notes: next.notes } : d,
      );
      setDomains(updated);
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

  const economiaCardTitle = useMemo(() => {
    const raw = new Date().toLocaleDateString("es-ES", { month: "long" });
    const month = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
    return month ? `Balance ${month}` : "Economía";
  }, []);

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
              {booting ? (
                <span style={{ display: "inline-block", width: 110, height: 12, borderRadius: 999, background: SKEL.bg }} />
              ) : (
                agendaMonthYear
              )}
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
                    background: booting ? "#161a22" : day.isToday ? "rgba(76, 201, 160, 0.12)" : "#161a22",
                    border: booting
                      ? "0.5px solid rgba(255, 255, 255, 0.07)"
                      : day.isToday
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
                    boxShadow: booting ? undefined : day.isToday ? "0 0 16px rgba(76, 201, 160, 0.2)" : undefined,
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
                  {booting ? (
                    <span style={{ display: "inline-block", width: 26, height: 9, borderRadius: 999, background: SKEL.bg }} />
                  ) : (
                    day.label
                  )}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: day.isToday ? C.green : C.text,
                  }}
                >
                  {booting ? (
                    <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: 6, background: SKEL.bg }} />
                  ) : (
                    day.num
                  )}
                </span>
                <div
                  style={{
                    minHeight: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {!booting && day.isToday ? (
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
                  {booting
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            backgroundColor: SKEL.fg,
                          }}
                        />
                      ))
                    : day.dots.map((c, i) => (
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

        {/* Nuestro hogar (dominios) */}
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
            <span style={{ ...sectionLabel, margin: 0 }}>Nuestro hogar</span>
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
                {domains.slice(0, 4).map((d) => {
                  const domHover = domainCardHover[d.name] ?? false;
                  return (
                  <button
                    key={d.id || d.name}
                    type="button"
                    onClick={() => setActiveDomainName(d.name)}
                    onMouseEnter={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: true }))}
                    onMouseLeave={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: false }))}
                    onTouchStart={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: true }))}
                    onTouchEnd={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: false }))}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: domHover
                        ? "0.5px solid rgba(255, 255, 255, 0.2)"
                        : "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                      textAlign: "left",
                      color: C.text,
                      cursor: "pointer",
                      font: "inherit",
                      transform: domHover ? "scale(1.03) translateY(-3px)" : "scale(1) translateY(0)",
                      transition: "all 0.2s ease",
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
                        {booting ? (
                          <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: SKEL.bg }} />
                        ) : (
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{d.emoji}</span>
                        )}
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
                          {booting ? (
                            <span style={{ display: "inline-block", width: 46, height: 8, borderRadius: 999, background: SKEL.bg }} />
                          ) : (
                            d.owner
                          )}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>
                        {booting ? <span style={{ display: "inline-block", width: "70%", height: 12, borderRadius: 999, background: SKEL.bg }} /> : d.name}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                        {booting ? <span style={{ display: "inline-block", width: "55%", height: 10, borderRadius: 999, background: SKEL.bg }} /> : d.state}
                      </p>
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
                        {booting ? <span style={{ display: "inline-block", width: 38, height: 10, borderRadius: 999, background: SKEL.bg }} /> : `${d.weight}/15`}
                      </p>
                    </div>
                  </button>
                  );
                })}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {domains.slice(4).map((d) => {
                  const domHover = domainCardHover[d.name] ?? false;
                  return (
                  <button
                    key={d.id || d.name}
                    type="button"
                    onClick={() => setActiveDomainName(d.name)}
                    onMouseEnter={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: true }))}
                    onMouseLeave={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: false }))}
                    onTouchStart={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: true }))}
                    onTouchEnd={() => setDomainCardHover((prev) => ({ ...prev, [d.name]: false }))}
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      background: "#161a22",
                      borderRadius: 14,
                      padding: 12,
                      border: domHover
                        ? "0.5px solid rgba(255, 255, 255, 0.2)"
                        : "0.5px solid rgba(255, 255, 255, 0.07)",
                      boxSizing: "border-box",
                      width: "100%",
                      textAlign: "left",
                      color: C.text,
                      cursor: "pointer",
                      font: "inherit",
                      transform: domHover ? "scale(1.03) translateY(-3px)" : "scale(1) translateY(0)",
                      transition: "all 0.2s ease",
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
                        {booting ? (
                          <span style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: SKEL.bg }} />
                        ) : (
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{d.emoji}</span>
                        )}
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
                          {booting ? (
                            <span style={{ display: "inline-block", width: 46, height: 8, borderRadius: 999, background: SKEL.bg }} />
                          ) : (
                            d.owner
                          )}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>
                        {booting ? <span style={{ display: "inline-block", width: "70%", height: 12, borderRadius: 999, background: SKEL.bg }} /> : d.name}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
                        {booting ? <span style={{ display: "inline-block", width: "55%", height: 10, borderRadius: 999, background: SKEL.bg }} /> : d.state}
                      </p>
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
                        {booting ? <span style={{ display: "inline-block", width: 38, height: 10, borderRadius: 999, background: SKEL.bg }} /> : `${d.weight}/15`}
                      </p>
                    </div>
                  </button>
                  );
                })}
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
              {booting ? <span style={{ display: "inline-block", width: 40, height: 10, borderRadius: 999, background: SKEL.bg }} /> : saludPendientes} pendientes
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
              {booting
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={idx}
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
                          borderColor: SKEL.line,
                          background: SKEL.bg,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ height: 10, width: "45%", borderRadius: 999, background: SKEL.bg }} />
                        <div style={{ marginTop: 6, height: 9, width: "92%", borderRadius: 8, background: SKEL.bg }} />
                        <div style={{ marginTop: 4, height: 9, width: "62%", borderRadius: 8, background: SKEL.bg }} />
                      </div>
                    </div>
                  ))
                : corchoMessages.slice(0, 3).map((msg, idx) => (
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
            marginBottom: 120,
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
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{economiaCardTitle}</p>
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
                {booting ? (
                  <span style={{ display: "inline-block", width: 100, height: 12, borderRadius: 999, background: SKEL.bg }} />
                ) : (
                  `${economia.totalMes.toFixed(2).replace(".", ",")}€`
                )}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 10,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                padding: 12,
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: C.muted,
                  }}
                >
                  Debe Ander
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: C.green }}>
                  {booting ? (
                    <span style={{ display: "inline-block", width: 86, height: 12, borderRadius: 999, background: SKEL.bg }} />
                  ) : (
                    `${economia.debeAnder.toFixed(2).replace(".", ",")}€`
                  )}
                </p>
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: C.muted,
                  }}
                >
                  Debe Leire
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: C.green }}>
                  {booting ? (
                    <span style={{ display: "inline-block", width: 86, height: 12, borderRadius: 999, background: SKEL.bg }} />
                  ) : (
                    `${economia.debeLeire.toFixed(2).replace(".", ",")}€`
                  )}
                </p>
              </div>
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {booting
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <li
                    // eslint-disable-next-line react/no-array-index-key
                    key={idx}
                    style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: SKEL.bg }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ height: 12, width: "78%", borderRadius: 999, background: SKEL.bg }} />
                      <div style={{ marginTop: 6, height: 9, width: "55%", borderRadius: 8, background: SKEL.bg }} />
                    </div>
                    <div style={{ width: 60, height: 12, borderRadius: 999, background: SKEL.bg }} />
                  </li>
                ))
              : expenses.slice(0, 3).map((e) => (
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
      {showAgent ? <AgentChat onClose={handleCloseAgentChat} /> : null}
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
            void (async () => {
              try {
                await updateStressLevel(uid, n);
                emitKoreUpdate(["profiles"]);
              } catch {
                /* Supabase no disponible: mismo estado local + LS */
              }
              if (perfil === "Ander") setAnderStress(n);
              else setLeireStress(n);
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

"use client";

import { AgentChat } from "@/components/AgentChat/AgentChat";
import { CorchoChat } from "@/components/CorchoChat";
import { CorchoHistorial } from "@/components/CorchoHistorial";
import { DomainModal, type DomainItem } from "@/components/DomainModal";
import { EconomiaModal, type ExpenseItem } from "@/components/EconomiaModal";
import { PerfilModal, type PerfilCitaRow, type PerfilNavigateTipo } from "@/components/PerfilModal";
import { SaludResumenModal } from "@/components/SaludResumenModal";
import { SaludModal } from "@/components/SaludModal";
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
  type CalendarEventRow,
  type Domain as KoreDomainRow,
  type Expense,
  type Profile,
  type HealthRecord,
  type KoreNote,
  type ShoppingItemRow,
  type CleaningTaskRow,
  type MenuItemRow,
  type SleepLogRow,
} from "@/lib/kore-db";
import { getProfiles, updateStressLevel } from "@/lib/actions/profiles";
import {
  getCalendarEvents,
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/actions/calendar";
import { getHealthRecords } from "@/lib/actions/health";
import { getExpenses } from "@/lib/actions/expenses";
import { getKoreNotes } from "@/lib/actions/corcho";
import {
  activateDomain,
  addDomainHistory,
  createCustomDomain,
  deactivateDomain,
  getDomainHistory,
  getDomains,
  updateDomain,
} from "@/lib/actions/domains";
import { getShoppingItems } from "@/lib/actions/shopping";
import { getPendingCleaningTasks } from "@/lib/actions/cleaning";
import { getWeeklyMenu } from "@/lib/actions/menu";
import { getSleepLogs } from "@/lib/actions/sleep";
import { useKoreRealtime } from "@/lib/kore-realtime";
import { emitKoreUpdate, onKoreUpdate } from "@/lib/kore-events";
import { getFamilyContext, resolvePartnerProfile, shouldShowPartnerInviteWidget } from "@/lib/family-utils";
import { BASE_DOMAINS } from "@/lib/domains-catalog";

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

type InactiveDomainOption = {
  id: string;
  name: string;
  emoji: string;
};

const DOMAINS: DomainCard[] = BASE_DOMAINS.map((domain) => ({
  id: domain.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"),
  name: domain.name,
  owner: "Sin asignar",
  weight: domain.weight,
  emoji: domain.emoji,
  state: "Sin actividad",
  line: domain.line,
  agent: domain.agent,
  notes: [],
}));

const CORCHO_MESSAGES: CorchoMessage[] = [];

type CorchoMessage = {
  who: string;
  avatar: string;
  ownerColor: string;
  text: string;
  when: string;
};

type HomeClientProps = {
  currentUserId: string;
  familyName: string;
  initialInviteCode?: string | null;
  partnerHasAuthAccount?: boolean;
  initialProfiles: Profile[];
  initialDomains: KoreDomainRow[];
  initialCalendarEvents: CalendarEventRow[];
  initialExpenses: Expense[];
  initialHealthRecords: HealthRecord[];
  initialKoreNotes: KoreNote[];
  initialShoppingItems: ShoppingItemRow[];
  initialPendingCleaningTasks: CleaningTaskRow[];
  initialWeeklyMenu: MenuItemRow[];
  initialSleepLogs: SleepLogRow[];
};

type MemberHealthData = {
  citas: PerfilCitaRow[];
  medicaciones: PerfilCitaRow[];
};

type DynamicSaludData = Record<string, MemberHealthData>;

function emptyHealthMember(): MemberHealthData {
  return { citas: [], medicaciones: [] };
}

function mapHealthRowsToDynamicSalud(rows: HealthRecord[]): DynamicSaludData {
  const out: DynamicSaludData = {};
  for (const r of rows) {
    if (!r.patient_id) continue;
    if (!out[r.patient_id]) out[r.patient_id] = emptyHealthMember();

    if (r.type === "appointment" && (r.date_time ?? "").trim()) {
      const raw = r.date_time ?? "";
      const [fecha, horaRaw] = raw.includes("T") ? raw.split("T") : [raw, ""];
      out[r.patient_id].citas.push({
        id: r.id,
        descripcion: r.description ?? "",
        fecha: fecha ?? "",
        hora: (horaRaw ?? "").slice(0, 5),
        lugar: "",
      });
    }

    if (r.type === "medication" && (r.next_dose_at ?? "").trim()) {
      const raw = r.next_dose_at ?? "";
      const [fecha, horaRaw] = raw.includes("T") ? raw.split("T") : [raw, ""];
      out[r.patient_id].medicaciones.push({
        id: r.id,
        descripcion: r.description ?? "",
        fecha: fecha ?? "",
        hora: (horaRaw ?? "").slice(0, 5),
        lugar: "",
      });
    }
  }
  return out;
}

function mapKoreNotesToCorchoMessages(rows: KoreNote[], profiles: Profile[]): CorchoMessage[] {
  const safeRows = rows ?? [];
  const safeProfiles = profiles ?? [];
  const colorByIndex = ["#4CC9A0", "#9B8FE8", "#EF9F27", "#E05555"];
  const indexByProfileId = new Map(safeProfiles.map((p, idx) => [p.id, idx]));
  return safeRows.slice(0, 3).map((r) => {
    const sender = safeProfiles.find((p) => p.id === r.sender_id) ?? null;
    const who = sender?.name ?? "Desconocido";
    const avatar = who.charAt(0).toUpperCase() || "?";
    const colorIdx = indexByProfileId.get(sender?.id ?? "") ?? 0;
    return {
      who,
      avatar,
      ownerColor: colorByIndex[colorIdx % colorByIndex.length],
      text: r.content ?? "(nota sin texto)",
      when: new Date(r.created_at ?? "").toLocaleString("es-ES"),
    };
  });
}

function calendarRowToEvent(row: CalendarEventRow): KoreAgendaEvent {
  return {
    id: row.id,
    titulo: row.title,
    fecha: (row.date ?? "").slice(0, 10),
    hora: (row.time ?? "").trim() ? row.time : null,
  };
}

function mapExpenseRowToItem(row: Expense, profiles: Profile[]): ExpenseItem {
  const safeProfiles = profiles ?? [];
  const allowed: ExpenseItem["category"][] = ["comida", "hogar", "salud", "ocio", "transporte", "otros"];
  const category = (allowed.includes(row.category as ExpenseItem["category"])
    ? row.category
    : "otros") as ExpenseItem["category"];
  const payer = safeProfiles.find((p) => p.id === row.payer_id) ?? null;
  return {
    id: row.id,
    desc: row.description,
    amount: row.amount,
    category,
    paidBy: payer?.id ?? row.payer_id ?? "",
    shared: row.is_shared ?? false,
    at: row.created_at ?? "",
  };
}

function mergedDomainCard(row: KoreDomainRow, profiles: Profile[]): DomainCard {
  const safeProfiles = profiles ?? [];
  const def = DOMAINS.find((d) => d.name === row.name);
  const owner = safeProfiles.find((p) => p.id === row.owner_id)?.name ?? "Sin asignar";
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
  if (primary.length > 0) return primary;
  return fallback;
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

export function HomeClient({
  currentUserId,
  familyName,
  initialInviteCode = null,
  partnerHasAuthAccount = false,
  initialProfiles = [],
  initialDomains = [],
  initialCalendarEvents = [],
  initialExpenses = [],
  initialHealthRecords = [],
  initialKoreNotes = [],
  initialShoppingItems = [],
  initialPendingCleaningTasks = [],
  initialWeeklyMenu = [],
  initialSleepLogs = [],
}: HomeClientProps) {
  const safeInitialProfiles = useMemo(() => initialProfiles ?? [], [initialProfiles]);
  const [line1, line2] = familyName.split(/[-\/\s]/, 2);
  const [showAgent, setShowAgent] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showCorcho, setShowCorcho] = useState(false);
  const [showCorchoHistorial, setShowCorchoHistorial] = useState(false);
  const [showEconomia, setShowEconomia] = useState(false);
  const [showSalud, setShowSalud] = useState(false);
  const [showSaludResumen, setShowSaludResumen] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [usuarioPerfil, setUsuarioPerfil] = useState<Profile | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAddCornerModal, setShowAddCornerModal] = useState(false);
  const [inactiveDomainOptions, setInactiveDomainOptions] = useState<InactiveDomainOption[]>([]);
  const [addCornerLoading, setAddCornerLoading] = useState(false);
  const [addCornerError, setAddCornerError] = useState("");
  const [customCornerName, setCustomCornerName] = useState("");
  const [customCornerEmoji, setCustomCornerEmoji] = useState("");
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | null>(null);
  const [agendaEvents, setAgendaEvents] = useState<KoreAgendaEvent[]>(
    (initialCalendarEvents ?? [])
      .filter((row) => withinAgendaWindow((row.date ?? "").slice(0, 10)))
      .map(calendarRowToEvent),
  );
  const [mounted, setMounted] = useState(false);
  const booting = false;

  const [domainsOpen, setDomainsOpen] = useState(true);
  const [domainCardHover, setDomainCardHover] = useState<Record<string, boolean>>({});
  const [domains, setDomains] = useState<DomainCard[]>(() => {
    const activeInitialDomains = (initialDomains ?? []).filter((row) => row.is_active === true);
    const mapped = activeInitialDomains.map((row) =>
      enrichSuenoDomain(
        enrichLimpiezaDomain(
          enrichMenuDomain(
            enrichComprasDomainFromShoppingItems(mergedDomainCard(row, safeInitialProfiles), initialShoppingItems ?? []),
            initialWeeklyMenu ?? [],
          ),
          initialPendingCleaningTasks ?? [],
        ),
        initialSleepLogs ?? [],
      ),
    );
    return mergeDomainsWithFallback(mapped, DOMAINS);
  });
  const [corchoMessages, setCorchoMessages] = useState<CorchoMessage[]>(
    mapKoreNotesToCorchoMessages(initialKoreNotes ?? [], safeInitialProfiles),
  );
  const [activeDomainName, setActiveDomainName] = useState<string | null>(null);
  const [domainHistoryList, setDomainHistoryList] = useState<DomainHistoryEntry[]>([]);
  const [healthOpen, setHealthOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    (initialExpenses ?? [])
      .map((row) => mapExpenseRowToItem(row, safeInitialProfiles))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
  );
  const [salud, setSalud] = useState<DynamicSaludData>(() => {
    const filtered = (initialHealthRecords ?? []).filter((r) => {
      const active = r.status === "active" || r.status === "pending";
      if (!active) return false;
      if (r.type === "appointment") return Boolean((r.date_time ?? "").trim());
      if (r.type === "medication") return Boolean((r.next_dose_at ?? "").trim());
      return false;
    });
    return mapHealthRowsToDynamicSalud(filtered);
  });
  const [stressByProfileId, setStressByProfileId] = useState<Record<string, number>>(() =>
    Object.fromEntries((safeInitialProfiles ?? []).map((p) => [p.id, Math.min(10, Math.max(1, Math.round(p.stress_level ?? 5)))])),
  );

  const familyContext = useMemo(
    () => getFamilyContext(safeInitialProfiles, currentUserId),
    [safeInitialProfiles, currentUserId],
  );

  const showPartnerInviteWidget = useMemo(
    () =>
      shouldShowPartnerInviteWidget(
        initialInviteCode,
        familyContext.currentUser,
        partnerHasAuthAccount,
      ),
    [initialInviteCode, familyContext.currentUser, partnerHasAuthAccount],
  );

  const handleCopyInviteCode = useCallback(async () => {
    const code = (initialInviteCode ?? "").trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [initialInviteCode]);

  const corchoPartner = useMemo(
    () => resolvePartnerProfile(familyContext.adults, currentUserId),
    [familyContext.adults, currentUserId],
  );

  const loadProfiles = useCallback(async () => {
    try {
      const profiles = await getProfiles();
      setStressByProfileId(
        Object.fromEntries(profiles.map((p) => [p.id, Math.min(10, Math.max(1, Math.round(p.stress_level ?? 5)))])),
      );
    } catch {
      setStressByProfileId((prev) => prev);
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
      const activeRows = rows.filter((row) => row.is_active === true);
      const mapped = activeRows.map((row) =>
        enrichSuenoDomain(
          enrichLimpiezaDomain(
            enrichMenuDomain(
              enrichComprasDomainFromShoppingItems(mergedDomainCard(row, safeInitialProfiles), shoppingItems),
              weeklyMenu,
            ),
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

  const loadInactiveDomainOptions = useCallback(async () => {
    setAddCornerLoading(true);
    setAddCornerError("");
    try {
      const rows = await getDomains();
      const byName = new Map(rows.map((row) => [row.name, row]));
      const options = BASE_DOMAINS
        .map((base) => ({ base, row: byName.get(base.name) }))
        .filter((entry) => entry.row && entry.row.is_active !== true)
        .map((entry) => ({
          id: entry.row!.id,
          name: entry.base.name,
          emoji: entry.base.emoji,
        }));
      setInactiveDomainOptions(options);
    } catch {
      setInactiveDomainOptions([]);
      setAddCornerError("No se pudieron cargar los rincones disponibles.");
    } finally {
      setAddCornerLoading(false);
    }
  }, []);

  const openAddCornerModal = useCallback(() => {
    setShowAddCornerModal(true);
    setCustomCornerName("");
    setCustomCornerEmoji("");
    void loadInactiveDomainOptions();
  }, [loadInactiveDomainOptions]);

  const handleActivateCorner = useCallback(async (domainId: string) => {
    setAddCornerError("");
    setAddCornerLoading(true);
    try {
      await activateDomain(domainId);
      emitKoreUpdate(["domains"]);
      await loadDomains();
      setShowAddCornerModal(false);
      setInactiveDomainOptions([]);
    } catch {
      setAddCornerError("No se pudo activar el rincón.");
    } finally {
      setAddCornerLoading(false);
    }
  }, [loadDomains]);

  const handleCreateCustomCorner = useCallback(async () => {
    const name = customCornerName.trim();
    const emoji = customCornerEmoji.trim();
    if (!name) {
      setAddCornerError("Escribe un nombre para el rincón.");
      return;
    }
    if (!emoji) {
      setAddCornerError("Añade un emoji para el rincón.");
      return;
    }
    setAddCornerError("");
    setAddCornerLoading(true);
    try {
      await createCustomDomain(name, emoji);
      emitKoreUpdate(["domains"]);
      setCustomCornerName("");
      setCustomCornerEmoji("");
      await loadDomains();
      setShowAddCornerModal(false);
      setInactiveDomainOptions([]);
    } catch {
      setAddCornerError("No se pudo crear el rincón personalizado.");
    } finally {
      setAddCornerLoading(false);
    }
  }, [customCornerEmoji, customCornerName, loadDomains]);

  const handleDeactivateCorner = useCallback(async (domainId: string) => {
    const confirmed = window.confirm("¿Desactivar este rincón? Volverá al catálogo de +");
    if (!confirmed) return;
    try {
      await deactivateDomain(domainId);
      emitKoreUpdate(["domains"]);
      await loadDomains();
    } catch {
      /* ignore */
    }
  }, [loadDomains]);

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
      const mapped = rows
        .map((row) => mapExpenseRowToItem(row, safeInitialProfiles))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
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
      setSalud(mapHealthRowsToDynamicSalud(filtered));
    } catch {
      setSalud({});
    }
  }, []);

  const loadCorcho = useCallback(async () => {
    try {
      const rows = await getKoreNotes();
      const mapped = mapKoreNotesToCorchoMessages(rows, safeInitialProfiles);
      setCorchoMessages(
        mapped.length > 0
          ? mapped
          : (initialKoreNotes ?? []).length > 0
            ? mapKoreNotesToCorchoMessages(initialKoreNotes ?? [], safeInitialProfiles)
            : CORCHO_MESSAGES,
      );
    } catch {
      setCorchoMessages(
        (initialKoreNotes ?? []).length > 0
          ? mapKoreNotesToCorchoMessages(initialKoreNotes ?? [], safeInitialProfiles)
          : CORCHO_MESSAGES,
      );
    }
  }, [initialKoreNotes, safeInitialProfiles]);

  const handleCloseAgentChat = useCallback(() => {
    setShowAgent(false);
    queueMicrotask(() => {
      void loadAgenda();
    });
  }, [loadAgenda]);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    const adults = familyContext.adults;
    const adultIds = adults.map((a) => a.id);
    const monthItems = expenses.filter((it) => {
      const d = new Date(it.at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const totalMes = monthItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const sharedItems = expenses.filter((it) => it.shared);
    const totalShared = sharedItems.reduce((acc, it) => acc + Math.abs(it.amount), 0);
    const paidByAdult = Object.fromEntries(adultIds.map((id) => [id, 0])) as Record<string, number>;
    for (const item of sharedItems) {
      if (paidByAdult[item.paidBy] != null) {
        paidByAdult[item.paidBy] += Math.abs(item.amount);
      }
    }
    const split = adults.length > 0 ? totalShared / adults.length : 0;
    const debtByAdult = Object.fromEntries(
      adultIds.map((id) => [id, Math.max(0, split - (paidByAdult[id] ?? 0))]),
    ) as Record<string, number>;
    return {
      totalMes,
      debtByAdult,
    };
  }, [expenses, familyContext.adults]);
  const saludPendientes = useMemo(() => {
    return Object.values(salud).reduce((acc, member) => acc + member.citas.length + member.medicaciones.length, 0);
  }, [salud]);

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
          created_by: familyContext.currentUser?.id ?? initialProfiles[0]?.id ?? "",
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
    const owner_id = initialProfiles.find((p) => p.name === next.owner)?.id ?? null;
    const histText = `Owner: ${next.owner} · Estado: ${next.state || "Sin estado"}${
      next.notes.length ? ` · Nota: ${next.notes[next.notes.length - 1]}` : ""
    }`;
    try {
      await updateDomain(current.id, { owner_id });
      await addDomainHistory(current.id, histText, familyContext.currentUser?.id ?? currentUserId ?? "");
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
      <div
        style={{
          ...mobileShell,
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.4s ease-in",
        }}
      >
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
          {familyName ? (
            <>
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
                {line1 ?? ""}
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
                {line2 ?? ""}
              </p>
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
          {familyContext.adults.slice(0, 2).map((profile, index) => {
            const stress = stressByProfileId[profile.id] ?? 5;
            return (
              <button
                key={profile.id}
                type="button"
                aria-label={`Perfil de ${profile.name}`}
                onClick={() => {
                  setUsuarioPerfil(profile);
                  setShowPerfil(true);
                }}
                style={{
                  ...avatarBase,
                  position: "relative",
                  zIndex: index + 1,
                  borderColor: avatarStressBorder(stress),
                  boxShadow: avatarStressShadow(stress),
                  marginLeft: index === 0 ? 0 : -10,
                  cursor: "pointer",
                  padding: 0,
                  font: "inherit",
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </button>
            );
          })}
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
        {showPartnerInviteWidget ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              maxHeight: 40,
              margin: "0 16px 6px",
              padding: "4px 4px 6px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "nowrap",
              boxSizing: "border-box",
              overflow: "hidden",
              background: "transparent",
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                lineHeight: 1.2,
                color: C.muted,
                fontFamily: "var(--font-dm-sans), sans-serif",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Invita a tu pareja:
            </span>
            <code
              style={{
                fontSize: 12,
                lineHeight: 1.2,
                fontWeight: 600,
                letterSpacing: "0.05em",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: C.green,
                minWidth: 0,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {(initialInviteCode ?? "").trim()}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyInviteCode()}
              title={inviteCopied ? "Copiado" : "Copiar código"}
              aria-label={inviteCopied ? "Código copiado" : "Copiar código de invitación"}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 28,
                minWidth: 28,
                padding: "0 6px",
                borderRadius: 6,
                border: "0.5px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: inviteCopied ? C.green : "rgba(228,230,237,0.75)",
                fontSize: 10,
                fontWeight: 600,
                fontFamily: "var(--font-dm-sans), sans-serif",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {inviteCopied ? (
                "✓"
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M8 5.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2M8 5.5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2M8 5.5h8a2 2 0 0 1 2 2v2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        ) : null}

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
                {domains.map((d) => {
                  const domHover = domainCardHover[d.name] ?? false;
                  return (
                  <div
                    key={d.id || d.name}
                    style={{
                      position: "relative",
                    }}
                  >
                    <button
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
                        width: "100%",
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
                    <button
                      type="button"
                      onClick={() => void handleDeactivateCorner(d.id)}
                      aria-label={`Desactivar ${d.name}`}
                      title="Desactivar rincón"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(9,11,16,0.65)",
                        color: "rgba(228,230,237,0.75)",
                        fontSize: 12,
                        lineHeight: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 2,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  );
                })}
                <button
                  type="button"
                  onClick={openAddCornerModal}
                  style={{
                    borderRadius: 14,
                    border: "1px dashed rgba(255, 255, 255, 0.22)",
                    background: "rgba(255,255,255,0.02)",
                    minHeight: 140,
                    padding: 12,
                    color: C.text,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    font: "inherit",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid rgba(76, 201, 160, 0.5)",
                      background: "rgba(76, 201, 160, 0.15)",
                      color: C.green,
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-hidden
                  >
                    +
                  </span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Más rincones</span>
                </button>
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
              {[...familyContext.children, ...familyContext.adults].map((member) => {
                const memberHealth = salud[member.id] ?? emptyHealthMember();
                const citas = memberHealth.citas;
                const meds = memberHealth.medicaciones;
                return (
                  <div
                    key={member.id}
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
                        color: member.role === "child" ? C.green : C.muted,
                      }}
                    >
                      {member.name}
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
                                {m.fecha} {m.hora} · {m.descripcion}
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
              {familyContext.adults.map((adult) => (
                <div key={adult.id}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: C.muted,
                    }}
                  >
                    Debe {adult.name}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: C.green }}>
                    {booting ? (
                      <span style={{ display: "inline-block", width: 86, height: 12, borderRadius: 999, background: SKEL.bg }} />
                    ) : (
                      `${(economia.debtByAdult[adult.id] ?? 0).toFixed(2).replace(".", ",")}€`
                    )}
                  </p>
                </div>
              ))}
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
          aria-label="Mensajes familiares"
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
          aria-label="Kore / Agente"
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

      {showCorcho ? (
        <CorchoChat
          onClose={() => setShowCorcho(false)}
          currentUserId={currentUserId}
          partnerUserId={corchoPartner?.id ?? ""}
          recipientName={corchoPartner?.name ?? "tu pareja"}
        />
      ) : null}
      {showCorchoHistorial ? (
        <CorchoHistorial
          onClose={() => setShowCorchoHistorial(false)}
          currentUserId={currentUserId}
          profiles={safeInitialProfiles}
        />
      ) : null}
      {showAgent && currentUserId ? (
        <AgentChat onClose={handleCloseAgentChat} currentUserId={currentUserId} />
      ) : null}
      {showEconomia ? (
        <EconomiaModal
          onClose={() => setShowEconomia(false)}
          members={familyContext.adults ?? []}
          onChange={(items) => setExpenses(items)}
        />
      ) : null}
      {showSalud ? (
        <SaludModal
          onClose={() => setShowSalud(false)}
          profiles={safeInitialProfiles ?? []}
          onChange={(next) => {
            const mapped: DynamicSaludData = {};
            for (const profile of safeInitialProfiles ?? []) {
              const legacy = next[profile.id];
              if (!legacy) continue;
              mapped[profile.id] = {
                citas: (legacy.citas ?? []).map((c) => ({ ...c })),
                medicaciones: (legacy.medicaciones ?? []).map((m) => ({
                  id: m.id,
                  descripcion: `${m.nombre} ${m.dosis}`.trim(),
                  fecha: (m.proximaToma ?? "").split("T")[0] ?? "",
                  hora: ((m.proximaToma ?? "").split("T")[1] ?? "").slice(0, 5),
                  lugar: "",
                })),
              };
            }
            setSalud(mapped);
          }}
        />
      ) : null}
      {showSaludResumen ? (
        <SaludResumenModal
          profiles={safeInitialProfiles}
          onClose={() => setShowSaludResumen(false)}
          onChange={() => void loadSalud()}
        />
      ) : null}
      {showPerfil && usuarioPerfil ? (
        <PerfilModal
          usuario={usuarioPerfil}
          onClose={() => setShowPerfil(false)}
          domains={domains}
          saludMember={salud[usuarioPerfil.id] ?? emptyHealthMember()}
          stressLevel={stressByProfileId[usuarioPerfil.id] ?? 5}
          onStressChange={(n) => {
            const profileId = usuarioPerfil.id;
            void (async () => {
              try {
                await updateStressLevel(profileId, n);
                emitKoreUpdate(["profiles"]);
              } catch {
                /* Supabase no disponible: mismo estado local + LS */
              }
              setStressByProfileId((prev) => ({ ...prev, [profileId]: n }));
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
          members={(familyContext.adults ?? []).map((p) => p.name)}
          actorId={familyContext.currentUser?.id ?? currentUserId}
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
      {showAddCornerModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Añadir rincones"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 8600,
            background: "rgba(9,11,16,0.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              maxHeight: "85vh",
              overflowY: "auto",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#161a22",
              color: C.text,
              padding: 14,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Más rincones</p>
              <button
                type="button"
                onClick={() => {
                  setShowAddCornerModal(false);
                  setAddCornerError("");
                }}
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: C.text,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <p style={{ margin: "0 0 8px", fontSize: 12, color: C.muted }}>Activa un rincón base</p>
            {addCornerLoading ? (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: C.muted }}>Cargando rincones…</p>
            ) : inactiveDomainOptions.length === 0 ? (
              <p style={{ margin: "0 0 10px", fontSize: 12, color: C.muted }}>No hay rincones base pendientes por activar.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {inactiveDomainOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void handleActivateCorner(option.id)}
                    disabled={addCornerLoading}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.04)",
                      color: C.text,
                      padding: "8px 10px",
                      textAlign: "left",
                      cursor: addCornerLoading ? "not-allowed" : "pointer",
                      opacity: addCornerLoading ? 0.6 : 1,
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{option.emoji}</span>
                    {option.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: C.muted }}>Rincón personalizado</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  value={customCornerEmoji}
                  onChange={(e) => setCustomCornerEmoji(e.target.value)}
                  placeholder="🙂"
                  maxLength={3}
                  style={{
                    width: 58,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: C.text,
                    padding: "8px",
                    textAlign: "center",
                    fontSize: 18,
                    boxSizing: "border-box",
                  }}
                />
                <input
                  value={customCornerName}
                  onChange={(e) => setCustomCornerName(e.target.value)}
                  placeholder="Nombre del rincón"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: C.text,
                    padding: "8px 10px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCreateCustomCorner()}
                disabled={addCornerLoading}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "none",
                  background: C.green,
                  color: "#0a1a14",
                  padding: "9px 10px",
                  fontWeight: 700,
                  cursor: addCornerLoading ? "not-allowed" : "pointer",
                  opacity: addCornerLoading ? 0.7 : 1,
                }}
              >
                Crear rincón
              </button>
            </div>

            {addCornerError ? (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: C.red }}>{addCornerError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}

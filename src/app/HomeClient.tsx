"use client";

import { AgentChat } from "@/components/AgentChat/AgentChat";
import { CorchoChat } from "@/components/CorchoChat";
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { CasaView } from "@/components/home/CasaView";
import { HomeHeader } from "@/components/home/HomeHeader";
import { HomeTabBar } from "@/components/home/HomeTabBar";
import { InicioView } from "@/components/home/InicioView";
import { YoView } from "@/components/home/YoView";
import {
  buildPendingRows,
  buildTodayAgenda,
  formatHomeDate,
  greetingFor,
  corchoNotePreview,
  type HomeTab,
  type PendingRow,
} from "@/components/home/home-model";

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
  type SchoolEventRow,
  type SleepSessionRow,
  sleepSessionDurationHours,
} from "@/lib/kore-db";
import { getProfiles, updateStressLevel } from "@/lib/actions/profiles";
import {
  getCalendarEvents,
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/actions/calendar";
import { getHealthRecords } from "@/lib/actions/health";
import { describeAppointment, describeMedication } from "@/lib/kore-salud-sync";
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
import { completeShoppingItem, getShoppingItems } from "@/lib/actions/shopping";
import { completeCleaningTask, getPendingCleaningTasks } from "@/lib/actions/cleaning";
import { getWeeklyMenu } from "@/lib/actions/menu";
import { getSchoolEvents } from "@/lib/actions/school";
import { getSleepSessions } from "@/lib/actions/sleep";
import { subscribeToNotificationsAction } from "@/lib/actions/push";
import { useKoreRealtime } from "@/lib/kore-realtime";
import { emitKoreUpdate, onKoreUpdate } from "@/lib/kore-events";
import { getFamilyContext, resolvePartnerProfile, shouldShowPartnerInviteWidget } from "@/lib/family-utils";
import { BASE_DOMAINS } from "@/lib/domains-catalog";
import { getBrowserClient } from "@/lib/supabase/client";

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

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
  id: string;
  who: string;
  text: string;
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
  initialSleepSessions: SleepSessionRow[];
  initialSchoolEvents: SchoolEventRow[];
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
      const view = describeAppointment(r.description, r.date_time);
      out[r.patient_id].citas.push({ id: r.id, ...view });
    }

    if (r.type === "medication" && (r.next_dose_at ?? "").trim()) {
      const view = describeMedication(r.description, r.next_dose_at);
      const raw = view.proximaToma || r.next_dose_at || "";
      const [fecha, horaRaw] = raw.includes("T") ? raw.split("T") : [raw, ""];
      out[r.patient_id].medicaciones.push({
        id: r.id,
        descripcion: view.dosis ? `${view.nombre} · ${view.dosis}` : view.nombre,
        fecha: fecha ?? "",
        hora: (horaRaw ?? "").slice(0, 5),
        lugar: "",
      });
    }
  }
  return out;
}

function mapKoreNotesToCorchoMessages(
  rows: Array<KoreNote & { imageUrls?: string[] }>,
  profiles: Profile[],
): CorchoMessage[] {
  const safeRows = rows ?? [];
  const safeProfiles = profiles ?? [];
  return safeRows.slice(0, 3).map((r) => {
    const sender = safeProfiles.find((p) => p.id === r.sender_id) ?? null;
    return {
      id: r.id,
      who: sender?.name ?? "Desconocido",
      text: corchoNotePreview(r.content, r.imageUrls?.length ?? 0),
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

function enrichSuenoDomain(
  domain: DomainCard,
  sessions: SleepSessionRow[],
  profiles: Profile[],
): DomainCard {
  if (domain.name !== "Sueño") return domain;
  const nameFor = (id: string) => profiles.find((p) => p.id === id)?.name ?? "?";
  const notes = sessions.slice(0, 3).map((s) => {
    const hours = sleepSessionDurationHours(s.sleep_start, s.sleep_end);
    return `${nameFor(s.profile_id)}: ${hours}h`;
  });
  return {
    ...domain,
    state: sessions.length > 0 ? `${sessions.length} sesión${sessions.length === 1 ? "" : "es"} (14 días)` : "Sin sesiones recientes",
    notes,
  };
}

function enrichColegioDomain(domain: DomainCard, events: SchoolEventRow[]): DomainCard {
  if (domain.name !== "Colegio") return domain;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => (e.date ?? "").slice(0, 10) >= today);
  const notes = upcoming.slice(0, 3).map((e) => {
    const d = (e.date ?? "").slice(5).replace("-", "/");
    return `${d}: ${e.title}`;
  });
  return {
    ...domain,
    state: upcoming.length > 0 ? `${upcoming.length} evento${upcoming.length === 1 ? "" : "s"} próximo${upcoming.length === 1 ? "" : "s"}` : "Sin eventos próximos",
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
  initialSleepSessions = [],
  initialSchoolEvents = [],
}: HomeClientProps) {
  const safeInitialProfiles = useMemo(() => initialProfiles ?? [], [initialProfiles]);
  const [tab, setTab] = useState<HomeTab>("inicio");
  const [showAgent, setShowAgent] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showEconomia, setShowEconomia] = useState(false);
  const [showSalud, setShowSalud] = useState(false);
  const [showSaludResumen, setShowSaludResumen] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [usuarioPerfil, setUsuarioPerfil] = useState<Profile | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarFocusComposer, setCalendarFocusComposer] = useState(false);
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

  const [shoppingItems, setShoppingItems] = useState<ShoppingItemRow[]>(initialShoppingItems ?? []);
  const [cleaningTasks, setCleaningTasks] = useState<CleaningTaskRow[]>(initialPendingCleaningTasks ?? []);
  const [domains, setDomains] = useState<DomainCard[]>(() => {
    const activeInitialDomains = (initialDomains ?? []).filter((row) => row.is_active === true);
    const mapped = activeInitialDomains.map((row) =>
      enrichColegioDomain(
        enrichSuenoDomain(
          enrichLimpiezaDomain(
            enrichMenuDomain(
              enrichComprasDomainFromShoppingItems(mergedDomainCard(row, safeInitialProfiles), initialShoppingItems ?? []),
              initialWeeklyMenu ?? [],
            ),
            initialPendingCleaningTasks ?? [],
          ),
          initialSleepSessions ?? [],
          safeInitialProfiles,
        ),
        initialSchoolEvents ?? [],
      ),
    );
    return mergeDomainsWithFallback(mapped, DOMAINS);
  });
  const [corchoMessages, setCorchoMessages] = useState<CorchoMessage[]>(
    mapKoreNotesToCorchoMessages(initialKoreNotes ?? [], safeInitialProfiles),
  );
  const [activeDomainName, setActiveDomainName] = useState<string | null>(null);
  const [domainHistoryList, setDomainHistoryList] = useState<DomainHistoryEntry[]>([]);
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
  const [pushSupported, setPushSupported] = useState(false);
  /** Solo true con permiso explícito "granted" y suscripción push; el botón se oculta cuando es true. */
  const [pushNotificationsActive, setPushNotificationsActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [showAdminLink, setShowAdminLink] = useState(false);

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

  useEffect(() => {
    setPushSupported(
      typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);

  useEffect(() => {
    const allowlist = (process.env.NEXT_PUBLIC_KORE_ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (!allowlist) {
      setShowAdminLink(false);
      return;
    }
    void (async () => {
      try {
        const supabase = getBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const email = (user?.email ?? "").trim().toLowerCase();
        setShowAdminLink(Boolean(email && email === allowlist));
      } catch {
        setShowAdminLink(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!pushSupported) return;
    void (async () => {
      try {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") {
          setPushNotificationsActive(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushNotificationsActive(!!sub);
      } catch {
        setPushNotificationsActive(false);
      }
    })();
  }, [pushSupported]);

  const handlePushToggle = useCallback(async () => {
    if (!pushSupported || safeInitialProfiles.length === 0) return;
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapid) return;
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
      }

      const asJson = sub.toJSON();
      const endpoint = asJson.endpoint;
      const p256dh = asJson.keys?.p256dh;
      const auth = asJson.keys?.auth;
      if (!endpoint || !p256dh || !auth) throw new Error("Suscripción incompleta");
      const deviceType = /Mobile|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
      await subscribeToNotificationsAction({ endpoint, keys: { p256dh, auth } }, deviceType);
      setPushNotificationsActive(true);
    } catch (err) {
      console.error("[HomeClient] handlePushToggle failed:", err);
    } finally {
      setPushBusy(false);
    }
  }, [pushSupported, safeInitialProfiles.length]);

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
      const [rows, shoppingRows, cleaningRows, weeklyMenu, sleepSessions, schoolEvents] = await Promise.all([
        getDomains(),
        getShoppingItems(),
        getPendingCleaningTasks(),
        getWeeklyMenu(),
        getSleepSessions(14),
        getSchoolEvents(),
      ]);
      setShoppingItems(shoppingRows);
      setCleaningTasks(cleaningRows);
      const activeRows = rows.filter((row) => row.is_active === true);
      const mapped = activeRows.map((row) =>
        enrichColegioDomain(
          enrichSuenoDomain(
            enrichLimpiezaDomain(
              enrichMenuDomain(
                enrichComprasDomainFromShoppingItems(mergedDomainCard(row, safeInitialProfiles), shoppingRows),
                weeklyMenu,
              ),
              cleaningRows,
            ),
            sleepSessions,
            safeInitialProfiles,
          ),
          schoolEvents,
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

  useKoreRealtime(
    useCallback(
      (table) => {
        queueMicrotask(() => {
          if (table === "domains") void loadDomains();
          else if (table === "shopping_items") void loadDomains();
          else if (table === "cleaning_tasks") void loadDomains();
          else if (table === "menu_items") void loadDomains();
          else if (table === "sleep_logs" || table === "sleep_sessions") void loadDomains();
          else if (table === "school_events") void loadDomains();
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
      if (tables.includes("sleep_logs") || tables.includes("sleep_sessions")) void loadDomains();
      if (tables.includes("school_events")) void loadDomains();
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

  const homeDate = useMemo(() => formatHomeDate(new Date()), []);
  const greeting = greetingFor(familyContext.currentUser?.name);
  const todayAgenda = useMemo(() => buildTodayAgenda(agendaEvents, new Date()), [agendaEvents]);
  const pending = useMemo(
    () =>
      buildPendingRows({
        shopping: shoppingItems,
        cleaning: cleaningTasks,
        note: corchoMessages[0]
          ? { id: corchoMessages[0].id, title: corchoMessages[0].text, subtitle: corchoMessages[0].who }
          : null,
      }),
    [cleaningTasks, corchoMessages, shoppingItems],
  );

  const openDomainByName = useCallback(
    (name: string) => {
      const found = domains.find((domain) => domain.name === name);
      if (found) setActiveDomainName(found.name);
      else setTab("casa");
    },
    [domains],
  );

  const handleOpenPending = useCallback(
    (row: PendingRow) => {
      if (row.kind === "shopping") openDomainByName("Compras");
      else if (row.kind === "cleaning") openDomainByName("Limpieza");
      else setTab("corcho");
    },
    [openDomainByName],
  );

  const handleCompletePending = useCallback(
    async (row: PendingRow) => {
      if (row.kind === "corcho") {
        setTab("corcho");
        return;
      }
      try {
        if (row.kind === "shopping") {
          setShoppingItems((prev) => prev.map((item) => (item.id === row.id ? { ...item, completed: true } : item)));
          await completeShoppingItem(row.id);
          emitKoreUpdate(["shopping_items"]);
        } else {
          setCleaningTasks((prev) => prev.filter((task) => task.id !== row.id));
          await completeCleaningTask(row.id);
          emitKoreUpdate(["cleaning_tasks"]);
        }
      } catch {
        void loadDomains();
      }
    },
    [loadDomains],
  );

  const openCurrentProfile = useCallback(() => {
    const profile = familyContext.currentUser ?? familyContext.adults[0] ?? null;
    if (!profile) return;
    setUsuarioPerfil(profile);
    setShowPerfil(true);
  }, [familyContext.adults, familyContext.currentUser]);

  return (
    <div className="min-h-dvh bg-[#14161b] text-[#e4e6ed]">
      <HomeHeader
        familyName={familyName}
        adults={familyContext.adults.slice(0, 2).map((profile) => ({ id: profile.id, name: profile.name }))}
        onOpenProfile={(id) => {
          const profile = safeInitialProfiles.find((item) => item.id === id);
          if (!profile) return;
          setUsuarioPerfil(profile);
          setShowPerfil(true);
        }}
      />
      <main className="mx-auto w-full max-w-6xl px-5 pt-20 pb-8 md:px-8">
        {tab === "inicio" ? (
          <InicioView
            greeting={greeting}
            dateLong={homeDate.long}
            dateShort={homeDate.short}
            agenda={todayAgenda}
            pendingMobile={pending.mobile}
            pendingDesktop={pending.desktop}
            domains={domains}
            showInvite={showPartnerInviteWidget}
            inviteCode={initialInviteCode}
            inviteCopied={inviteCopied}
            onCopyInvite={() => void handleCopyInviteCode()}
            onOpenCalendar={() => {
              setCalendarFocusComposer(false);
              setCalendarInitialDate(new Date());
              setShowCalendar(true);
            }}
            onAddAgenda={() => {
              setCalendarFocusComposer(true);
              setCalendarInitialDate(new Date());
              setShowCalendar(true);
            }}
            onAddPending={(kind) => {
              if (kind === "shopping") openDomainByName("Compras");
              else openDomainByName("Limpieza");
            }}
            onComplete={(row) => void handleCompletePending(row)}
            onOpenPending={handleOpenPending}
            onOpenCasa={() => setTab("casa")}
            onOpenDomain={openDomainByName}
            onDeactivateDomain={(id) => void handleDeactivateCorner(id)}
          />
        ) : null}
        {tab === "casa" ? (
          <CasaView
            domains={domains}
            onOpenDomain={openDomainByName}
            onDeactivateDomain={(id) => void handleDeactivateCorner(id)}
            onAddCorner={openAddCornerModal}
            onOpenSalud={() => setShowSalud(true)}
            onOpenSaludResumen={() => setShowSaludResumen(true)}
            saludPendientes={saludPendientes}
            members={[...familyContext.children, ...familyContext.adults].map((member) => ({
              id: member.id,
              name: member.name,
              role: member.role ?? "",
            }))}
            salud={salud}
            onOpenEconomia={() => setShowEconomia(true)}
            economiaTitle={economiaCardTitle}
            totalMes={economia.totalMes}
            debtByAdult={economia.debtByAdult}
            adults={familyContext.adults.map((adult) => ({ id: adult.id, name: adult.name }))}
            expenses={expenses}
          />
        ) : null}
        {tab === "corcho" ? (
          <div className="flex h-[calc(100dvh-9.5rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/[0.07]">
            <CorchoChat
              embedded
              onClose={() => setTab("inicio")}
              currentUserId={currentUserId}
              partnerUserId={corchoPartner?.id ?? ""}
              recipientName={corchoPartner?.name ?? "tu pareja"}
            />
          </div>
        ) : null}
        {tab === "yo" ? (
          <YoView
            name={familyContext.currentUser?.name ?? ""}
            onOpenProfile={openCurrentProfile}
            onOpenAgent={() => setShowAgent(true)}
            pushSupported={pushSupported && safeInitialProfiles.length > 0}
            pushActive={pushNotificationsActive}
            pushBusy={pushBusy}
            onEnablePush={() => void handlePushToggle()}
            showAdmin={showAdminLink}
          />
        ) : null}
      </main>
      <HomeTabBar tab={tab} onChange={setTab} onOpenAgent={() => setShowAgent(true)} />
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
          profiles={safeInitialProfiles}
        />
      ) : null}

      {showCalendar ? (
        <CalendarModal
          onClose={() => {
            setShowCalendar(false);
            setCalendarInitialDate(null);
            setCalendarFocusComposer(false);
          }}
          events={agendaEvents}
          initialDate={calendarInitialDate}
          focusComposer={calendarFocusComposer}
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
  );
}

export type PlannedTool = { tool: string; args: Record<string, unknown> };

const REPLACE_VERBS = /\b(cambia|borra|sustituye|reemplaza)\b/i;
const SMART_EXPENSE_KEYWORDS = /\b(avisa|dile|comparte|entre los dos|avisar)\b/i;

function normalizeText(input: string): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isMutationTool(name: string): boolean {
  return /^(add_|save_|log_|update_|clear_|delete_)/.test(name);
}

function isReadTool(name: string): boolean {
  return name.startsWith("get_");
}

function isDestructiveTool(name: string): boolean {
  return name.startsWith("clear_") || name.startsWith("delete_");
}

function isCommunicationTool(name: string): boolean {
  return name === "send_note" || name === "add_kore_note";
}

function toolRank(name: string): number {
  if (isDestructiveTool(name)) return 1;
  if (/^(add_|save_|log_|update_)/.test(name)) return 2;
  if (isCommunicationTool(name)) return 3;
  if (isReadTool(name)) return 4;
  return 5;
}

function toolDomain(name: string): string {
  if (name.includes("calendar")) return "agenda";
  if (name.includes("health") || name.includes("appointment") || name.includes("medication")) return "salud";
  if (name.includes("expense")) return "economia";
  if (name.includes("shopping")) return "compras";
  if (name.includes("cleaning")) return "limpieza";
  if (name.includes("menu")) return "menu";
  if (name.includes("school")) return "colegio";
  if (name.includes("leisure") || name.includes("personal_time") || name.includes("balance_summary")) return "ocio";
  if (name.includes("sleep") || name.includes("wakeup") || name.includes("recovery")) return "sueno";
  if (name.includes("note")) return "corcho";
  if (name.includes("pattern") || name.includes("memory") || name.includes("insight")) return "memoria";
  return "otros";
}

function estimateEntityCountForDomain(domain: string, userMsg: string): number {
  const text = normalizeText(userMsg);
  if (domain === "compras" || domain === "otros") {
    const separators = (text.match(/\s+y\s|,|\stambien\s/g) ?? []).length;
    return Math.min(5, Math.max(1, separators + 1));
  }
  return 1;
}

function enforceCalendarPairRule(plan: PlannedTool[]): PlannedTool[] {
  const hasAppointment = plan.some((p) => p.tool === "add_appointment");
  const hasSchoolEvent = plan.some((p) => p.tool === "add_school_event");
  const hasCalendar = plan.some((p) => p.tool === "add_calendar_event");
  if ((!hasAppointment && !hasSchoolEvent) || hasCalendar) return plan;

  const source = hasAppointment
    ? plan.find((p) => p.tool === "add_appointment")
    : plan.find((p) => p.tool === "add_school_event");
  if (!source) return plan;

  const title =
    source.tool === "add_appointment"
      ? String(source.args.description ?? "Cita médica")
      : String(source.args.title ?? "Evento");
  const date = String(source.args.date ?? "").trim();
  const time = String(source.args.time ?? "09:00").trim() || "09:00";
  if (!date) return plan;

  return [...plan, { tool: "add_calendar_event", args: { title, date, time } }];
}

function expandMultiEntityPlan(plan: PlannedTool[], userMsg: string): PlannedTool[] {
  const normalized = normalizeText(userMsg);
  const out: PlannedTool[] = [];
  for (const p of plan) {
    if (p.tool !== "add_shopping_item") {
      out.push(p);
      continue;
    }
    const nameRaw = String(p.args.name ?? "").trim();
    if (!nameRaw) {
      out.push(p);
      continue;
    }
    const pieces = nameRaw
      .split(/\s+y\s|,|\stambien\s/i)
      .map((x) => x.trim())
      .filter(Boolean);
    const shouldSplit = pieces.length > 1 || / y |,| tambien /.test(normalized);
    if (!shouldSplit || pieces.length <= 1) {
      out.push(p);
      continue;
    }
    for (const item of pieces) {
      out.push({ tool: "add_shopping_item", args: { ...p.args, name: item } });
    }
  }
  return out;
}

function applySmartExpense(plan: PlannedTool[], userMessage: string): PlannedTool[] {
  const normalized = normalizeText(userMessage);
  const hasKeyword = SMART_EXPENSE_KEYWORDS.test(normalized);
  const expense = plan.find((p) => p.tool === "add_expense");
  const hasSendNote = plan.some((p) => p.tool === "send_note");
  if (!expense || !hasSendNote) return plan;

  const amount = Number(expense.args.amount);
  const shouldKeepNote = hasKeyword || (!Number.isNaN(amount) && amount > 50);
  if (shouldKeepNote) return plan;
  return plan.filter((p) => p.tool !== "send_note");
}

function dedupeBySignature(plan: PlannedTool[]): PlannedTool[] {
  const seen = new Set<string>();
  const out: PlannedTool[] = [];
  for (const p of plan) {
    const key = `${p.tool}:${JSON.stringify(p.args)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function applyGuardrails(plan: PlannedTool[], userMessage: string): PlannedTool[] {
  let out = [...plan];
  const normalizedUser = normalizeText(userMessage);
  const allowReplace = REPLACE_VERBS.test(normalizedUser);

  out = expandMultiEntityPlan(out, userMessage);
  out = enforceCalendarPairRule(out);
  out = applySmartExpense(out, userMessage);

  // 1) Menú exclusión clear+add mismo día salvo verbos sustitución
  if (!allowReplace) {
    const addDays = new Set(
      out
        .filter((p) => p.tool === "add_menu_item")
        .map((p) => String(p.args.day ?? "").toLowerCase())
        .filter(Boolean),
    );
    out = out.filter((p) => !(p.tool === "clear_day_menu" && addDays.has(String(p.args.day ?? "").toLowerCase())));
  }

  // 2) Compras get_shopping_list: solo uno al final si hubo inserciones
  const hadShoppingAdd = out.some((p) => p.tool === "add_shopping_item");
  const shoppingGets = out.filter((p) => p.tool === "get_shopping_list");
  if (shoppingGets.length > 0) {
    out = out.filter((p) => p.tool !== "get_shopping_list");
    if (hadShoppingAdd) out.push({ tool: "get_shopping_list", args: {} });
  }

  // 3) Limpieza dedupe strict zone+assigned_to
  const seenCleaning = new Set<string>();
  out = out.filter((p) => {
    if (p.tool !== "add_cleaning_task") return true;
    const key = `${String(p.args.zone ?? "").toLowerCase()}|${String(p.args.assigned_to ?? "").toLowerCase()}`;
    if (seenCleaning.has(key)) return false;
    seenCleaning.add(key);
    return true;
  });

  // 4) Agenda+Salud coexistencia: explícitamente sin exclusión

  // Bloqueo mutación fantasma por dominio
  const domainMutationCount = new Map<string, number>();
  const keep: PlannedTool[] = [];
  for (const p of out) {
    if (!isMutationTool(p.tool)) {
      keep.push(p);
      continue;
    }
    const domain = toolDomain(p.tool);
    const current = domainMutationCount.get(domain) ?? 0;
    const maxAllowed = estimateEntityCountForDomain(domain, userMessage);
    if (current >= maxAllowed && !(domain === "salud" && (p.tool === "add_appointment" || p.tool === "add_calendar_event"))) {
      continue;
    }
    domainMutationCount.set(domain, current + 1);
    keep.push(p);
  }
  out = keep;

  // Jerarquía de ejecución
  out = out
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => {
      const ra = toolRank(a.p.tool);
      const rb = toolRank(b.p.tool);
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    })
    .map((x) => x.p);

  // Máximo una lectura al final
  const reads = out.filter((p) => isReadTool(p.tool));
  if (reads.length > 1) {
    out = out.filter((p) => !isReadTool(p.tool));
    out.push(reads[reads.length - 1]);
  }

  // Normalización por duplicados de plan (misma tool+args)
  out = dedupeBySignature(out);
  return out;
}

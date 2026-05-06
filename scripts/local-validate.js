const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ANDER_ID = "6204d1a5-bbba-4a01-a9f2-b0742ee0bcd4";

function readEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    out[key] = value;
  }
  return out;
}

function isoDateDaysAhead(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function insertCalendarEvent(supabaseUrl, anonKey, title, date) {
  const res = await fetch(`${supabaseUrl}/rest/v1/calendar_events`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ title, date, time: "10:00", created_by: ANDER_ID }]),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Insert calendar_event failed: ${res.status} ${txt}`);
  }
}

async function insertHealthRecord(supabaseUrl, anonKey, desc, oldIso) {
  const res = await fetch(`${supabaseUrl}/rest/v1/health_records`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([
      {
        patient_id: ANDER_ID,
        type: "medication",
        description: desc,
        date_time: oldIso,
        next_dose_at: oldIso,
        status: "active",
      },
    ]),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Insert health_record failed: ${res.status} ${txt}`);
  }
}

function escapeRegExp(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const env = readEnvLocal();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");

  const eventTitle = "E2E Agenda +15 1778009714663";
  const eventDate = isoDateDaysAhead(15);
  await insertCalendarEvent(supabaseUrl, anonKey, eventTitle, eventDate);

  const healthDesc = "E2E Salud activa vieja 1778009715648";
  const oldIso = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  await insertHealthRecord(supabaseUrl, anonKey, healthDesc, oldIso);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = "http://localhost:3000";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const results = [];

  // 1) Nuestro Hogar: 6 cards (+ toggle => 7 botones)
  const hogarSection = page.locator("section").filter({ hasText: "Nuestro hogar" }).first();
  await hogarSection.waitFor({ state: "visible" });
  const hogarButtons = hogarSection.getByRole("button");
  const hogarCount = await hogarButtons.count();
  results.push({
    check: "hogar_cards",
    ok: hogarCount === 7,
    detail: `botones_en_seccion=${hogarCount}`,
  });

  // 2) Agenda: evento +15 visible en calendario
  try {
    await page.getByRole("button", { name: "Ver calendario →" }).click({ force: true });
    await page.getByText(new RegExp(escapeRegExp(eventTitle), "i")).waitFor({ state: "visible", timeout: 15000 });
    await page.keyboard.press("Escape");
    results.push({ check: "agenda_30d_event", ok: true, detail: eventTitle });
  } catch (e) {
    results.push({ check: "agenda_30d_event", ok: false, detail: String(e.message || e) });
  }

  // 3) Compras: modal real muestra "leche"
  try {
    await page.getByRole("button", { name: /Compras/i }).first().click({ force: true });
    await page.getByRole("dialog", { name: "Lista de la compra" }).waitFor({ state: "visible", timeout: 10000 });
    await page.getByText(/leche/i).waitFor({ state: "visible", timeout: 10000 });
    await page.keyboard.press("Escape");
    results.push({ check: "shopping_leche", ok: true, detail: "leche_visible" });
  } catch (e) {
    results.push({ check: "shopping_leche", ok: false, detail: String(e.message || e) });
  }

  // 4) Salud: mostrar active/pending aunque >24h
  try {
    await page.getByRole("button", { name: /Expandir salud/i }).click({ force: true });
    await page.getByText(new RegExp(escapeRegExp(healthDesc), "i")).waitFor({ state: "visible", timeout: 15000 });
    results.push({ check: "salud_active_pending", ok: true, detail: healthDesc });
  } catch (e) {
    results.push({ check: "salud_active_pending", ok: false, detail: String(e.message || e) });
  }

  await browser.close();
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FAIL"} ${r.check} :: ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`Fallaron ${failed.length} checks`);
  }
  console.log("VALIDACION_OK");
}

main().catch((err) => {
  console.error("VALIDACION_ERROR:", err.message);
  process.exit(1);
});

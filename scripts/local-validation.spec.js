const { test, expect } = require("playwright/test");

function formatIsoDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test.describe.configure({ mode: "serial" });

test("validacion local de Home Kore", async ({ page, request }) => {
  const baseUrl = "http://localhost:3000";

  // 1) Nuestro Hogar: 6 cards (más botón de toggle = 7 botones)
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const hogarSection = page.locator("section").filter({ hasText: "Nuestro hogar" }).first();
  await expect(hogarSection).toBeVisible();
  await expect(hogarSection.getByRole("button")).toHaveCount(7);

  // 2) Agenda: insertar evento hoy+15 y verificar en calendario
  const eventDate = formatIsoDate(15);
  const eventTitle = `E2E cumpleaños 6 mayo ${Date.now()}`;
  const addEventRes = await request.post(`${baseUrl}/api/agent`, {
    data: {
      mensaje: `Añade a la agenda familiar el evento "${eventTitle}" el ${eventDate} a las 10:00`,
      historial: [],
    },
  });
  expect(addEventRes.ok()).toBeTruthy();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ver calendario →" }).click();
  await expect(page.getByText(eventTitle)).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("Escape");

  // 3) Compras: abrir modal y verificar "leche"
  await page.getByRole("button", { name: /Compras/i }).first().click();
  await expect(page.getByRole("dialog", { name: "Lista de la compra" })).toBeVisible();
  await expect(page.getByText(/leche/i)).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");

  // 4) Salud: crear medicación ACTIVE vieja y verificar que aparece
  const oldIso = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const oldName = `E2E medicacion vieja ${Date.now()}`;
  const addHealthRes = await request.post(`${baseUrl}/api/agent`, {
    data: {
      mensaje: `Añade una medicación para Ander llamada "${oldName}" con dosis 1 pastilla cada 8 horas y próxima toma ${oldIso}`,
      historial: [],
    },
  });
  expect(addHealthRes.ok()).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Expandir salud/i }).click();
  await expect(page.getByText(new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).toBeVisible({
    timeout: 15000,
  });
});

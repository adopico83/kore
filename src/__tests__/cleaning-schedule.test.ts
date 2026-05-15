import { describe, expect, it } from "vitest";

import {
  addDays,
  computeInitialNextDueDate,
  computeNextDueDate,
  formatDateIso,
  normalizeCleaningFrequency,
  todayIsoDate,
} from "@/lib/cleaning-schedule";

describe("cleaning-schedule", () => {
  it("normaliza alias de frecuencia", () => {
    expect(normalizeCleaningFrequency("weekly")).toBe("semanal");
    expect(normalizeCleaningFrequency("DAILY")).toBe("diaria");
    expect(normalizeCleaningFrequency("")).toBe("semanal");
  });

  it("calcula próximo vencimiento según frecuencia", () => {
    const base = new Date("2026-05-15T12:00:00");
    expect(formatDateIso(computeNextDueDate(base, "diaria"))).toBe("2026-05-16");
    expect(formatDateIso(computeNextDueDate(base, "semanal"))).toBe("2026-05-22");
    expect(formatDateIso(computeNextDueDate(base, "mensual"))).toBe("2026-06-14");
  });

  it("addDays no muta la fecha original", () => {
    const base = new Date("2026-05-15T12:00:00");
    const next = addDays(base, 7);
    expect(formatDateIso(base)).toBe("2026-05-15");
    expect(formatDateIso(next)).toBe("2026-05-22");
  });

  it("computeInitialNextDueDate devuelve ISO date", () => {
    const created = new Date("2026-01-01T08:00:00");
    expect(computeInitialNextDueDate(created, "semanal")).toBe("2026-01-08");
  });

  it("todayIsoDate tiene formato YYYY-MM-DD", () => {
    expect(todayIsoDate(new Date("2026-05-15T23:59:00"))).toBe("2026-05-15");
  });
});

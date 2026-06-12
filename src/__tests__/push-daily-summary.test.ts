import { describe, expect, it, vi } from "vitest";

import {
  buildFallbackDailySummaryMessage,
  hasRelevantDailySummary,
  type DailySummaryContext,
} from "@/lib/push-daily-summary";

const baseCtx: DailySummaryContext = {
  familyId: "f1",
  familyName: "Familia Test",
  todayIso: "2026-06-12",
  tomorrowIso: "2026-06-13",
  cleaningTasks: [],
  tomorrowEvents: [],
  healthItems: [],
};

describe("push-daily-summary", () => {
  it("hasRelevantDailySummary es false sin datos", () => {
    expect(hasRelevantDailySummary(baseCtx)).toBe(false);
  });

  it("hasRelevantDailySummary es true con limpieza pendiente", () => {
    expect(
      hasRelevantDailySummary({
        ...baseCtx,
        cleaningTasks: [
          {
            id: "1",
            zone: "Cocina",
            task: "Hornos",
            frequency: "semanal",
            assigned_to: null,
            completed: false,
            created_at: "",
            last_completed_at: null,
            next_due_at: "2026-06-12",
          },
        ],
      }),
    ).toBe(true);
  });

  it("buildFallbackDailySummaryMessage incluye limpieza, agenda y salud", () => {
    const msg = buildFallbackDailySummaryMessage({
      ...baseCtx,
      cleaningTasks: [
        {
          id: "1",
          zone: "Baño",
          task: "Espejo",
          frequency: "semanal",
          assigned_to: null,
          completed: false,
          created_at: "",
          last_completed_at: null,
          next_due_at: "2026-06-12",
        },
      ],
      tomorrowEvents: [
        {
          id: "e1",
          title: "Pediatra",
          date: "2026-06-13",
          time: "09:30",
          created_by: null,
          created_at: "",
        },
      ],
      healthItems: [{ kind: "medication", patientName: "Leo", description: "Antibiótico", whenLabel: "08:00" }],
    });
    expect(msg).toContain("Familia Test");
    expect(msg).toContain("Limpieza hoy");
    expect(msg).toContain("Mañana en agenda");
    expect(msg).toContain("Salud");
  });

  it("generateDailySummaryMessage usa fallback si no hay OPENAI_API_KEY", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { generateDailySummaryMessage } = await import("@/lib/push-daily-summary");
    const msg = await generateDailySummaryMessage({
      ...baseCtx,
      cleaningTasks: [
        {
          id: "1",
          zone: "Salón",
          task: "Aspirar",
          frequency: "semanal",
          assigned_to: null,
          completed: false,
          created_at: "",
          last_completed_at: null,
          next_due_at: "2026-06-12",
        },
      ],
    });
    expect(msg).toContain("Limpieza hoy");
    vi.unstubAllEnvs();
  });
});

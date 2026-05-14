import { describe, expect, it } from "vitest";

import { generateInviteCode, normalizeInviteCode, parseInviteCodeFromInput } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("usa prefijo KORE- y 4 caracteres del alfabeto acordado", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^KORE-[A-Z2-9]{4}$/);
  });
});

describe("parseInviteCodeFromInput", () => {
  it("normaliza variantes con guion y mayúsculas", () => {
    expect(parseInviteCodeFromInput("kore-a3x9")).toBe("KORE-A3X9");
    expect(parseInviteCodeFromInput("KORE-A3X9")).toBe("KORE-A3X9");
    expect(parseInviteCodeFromInput("a3x9")).toBe("KORE-A3X9");
  });

  it("devuelve null si el formato no cuadra", () => {
    expect(parseInviteCodeFromInput("")).toBeNull();
    expect(parseInviteCodeFromInput("KORE-ABC")).toBeNull();
    expect(parseInviteCodeFromInput("KORE-ABCDE")).toBeNull();
  });
});

describe("normalizeInviteCode", () => {
  it("quita prefijo y separadores", () => {
    expect(normalizeInviteCode("KORE-A3X9")).toBe("A3X9");
  });
});

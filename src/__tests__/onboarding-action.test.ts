import { beforeEach, describe, expect, it, vi } from "vitest";

type FamilyRow = { id: string; onboarding_step: string | null };
type DomainRow = { id: string; family_id: string | null; is_active: boolean | null };
type ProfileRow = { id: string; name: string; family_id: string | null; role: string | null };

const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

type FakeDbState = {
  families: FamilyRow[];
  domains: DomainRow[];
  profiles: ProfileRow[];
};

type FakeOptions = {
  failChildInsertName?: string;
};

class FakeQueryBuilder {
  private operation: "select" | "update" | "delete" | null = null;
  private filters: Array<{ type: "eq" | "in"; column: string; value: unknown }> = [];
  private updatePayload: Record<string, unknown> = {};
  private expectSingle = false;

  constructor(
    private readonly table: keyof FakeDbState,
    private readonly state: FakeDbState,
    private readonly options: FakeOptions,
  ) {}

  select(_columns: string) {
    this.operation = "select";
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.operation = "update";
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: "in", column, value: values });
    return this;
  }

  async insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    const rows = Array.isArray(payload) ? payload : [payload];
    if (this.table !== "profiles") return { error: null };

    for (const row of rows) {
      const name = String(row.name ?? "");
      const role = String(row.role ?? "");
      if (role === "child" && this.options.failChildInsertName === name) {
        return { error: { message: `forced child insert failure: ${name}` } };
      }
      this.state.profiles.push({
        id: String(row.id),
        name,
        family_id: (row.family_id as string | null) ?? null,
        role: role || null,
      });
    }
    return { error: null };
  }

  async single() {
    this.expectSingle = true;
    return this.executeSelect();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private getRows() {
    return this.state[this.table] as Array<Record<string, unknown>>;
  }

  private applyFilters(rows: Array<Record<string, unknown>>) {
    return rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.type === "eq") return row[filter.column] === filter.value;
        const values = Array.isArray(filter.value) ? filter.value : [];
        return values.includes(row[filter.column]);
      }),
    );
  }

  private async executeSelect() {
    const filtered = this.applyFilters(this.getRows());
    if (!this.expectSingle) return { data: filtered, error: null };
    if (filtered.length !== 1) return { data: null, error: { message: "single row not found" } };
    return { data: filtered[0], error: null };
  }

  private async executeUpdate() {
    const rows = this.getRows();
    const filtered = this.applyFilters(rows);
    for (const row of filtered) Object.assign(row, this.updatePayload);
    return { error: null };
  }

  private async executeDelete() {
    const rows = this.getRows();
    const toDelete = new Set(this.applyFilters(rows).map((row) => row.id));
    if (this.table === "families") {
      this.state.families = this.state.families.filter((row) => !toDelete.has(row.id));
    } else if (this.table === "domains") {
      this.state.domains = this.state.domains.filter((row) => !toDelete.has(row.id));
    } else {
      this.state.profiles = this.state.profiles.filter((row) => !toDelete.has(row.id));
    }
    return { error: null };
  }

  private async execute() {
    if (this.operation === "select") return this.executeSelect();
    if (this.operation === "update") return this.executeUpdate();
    if (this.operation === "delete") return this.executeDelete();
    return { data: null, error: null };
  }
}

function createFakeAdminClient(initial: FakeDbState, options: FakeOptions = {}) {
  const state: FakeDbState = {
    families: structuredClone(initial.families),
    domains: structuredClone(initial.domains),
    profiles: structuredClone(initial.profiles),
  };

  const admin = {
    from(table: keyof FakeDbState) {
      return new FakeQueryBuilder(table, state, options);
    },
  };

  return { admin, state };
}

describe("completeOnboardingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("éxito completo: persiste familia, pareja, hijos y dominios", async () => {
    const { admin, state } = createFakeAdminClient({
      families: [{ id: "fam-1", onboarding_step: "pending" }],
      domains: [
        { id: "dom-1", family_id: "fam-1", is_active: false },
        { id: "dom-2", family_id: "fam-1", is_active: false },
      ],
      profiles: [],
    });
    mockCreateAdminClient.mockReturnValue(admin);
    const randomSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomSpy.mockReturnValueOnce("p-partner").mockReturnValueOnce("p-child-1").mockReturnValueOnce("p-child-2");

    const { completeOnboardingAction } = await import("@/lib/actions/onboarding");
    await expect(
      completeOnboardingAction({
        familyId: "fam-1",
        partnerName: "Ana",
        childrenNames: ["Leo", "Mia"],
        selectedDomainIds: ["dom-1", "dom-2"],
      }),
    ).resolves.toEqual({ success: true });

    expect(state.families[0].onboarding_step).toBe("completed");
    expect(state.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "p-partner", name: "Ana", role: "member", family_id: "fam-1" }),
        expect.objectContaining({ id: "p-child-1", name: "Leo", role: "child", family_id: "fam-1" }),
        expect.objectContaining({ id: "p-child-2", name: "Mia", role: "child", family_id: "fam-1" }),
      ]),
    );
    expect(state.domains.find((d) => d.id === "dom-1")?.is_active).toBe(true);
    expect(state.domains.find((d) => d.id === "dom-2")?.is_active).toBe(true);
    randomSpy.mockRestore();
  });

  it("rollback: si falla un hijo revierte cambios previos", async () => {
    const { admin, state } = createFakeAdminClient(
      {
        families: [{ id: "fam-1", onboarding_step: "pending" }],
        domains: [{ id: "dom-1", family_id: "fam-1", is_active: false }],
        profiles: [],
      },
      { failChildInsertName: "Mia" },
    );
    mockCreateAdminClient.mockReturnValue(admin);
    const randomSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomSpy.mockReturnValueOnce("p-partner").mockReturnValueOnce("p-child-1").mockReturnValueOnce("p-child-2");

    const { completeOnboardingAction } = await import("@/lib/actions/onboarding");
    await expect(
      completeOnboardingAction({
        familyId: "fam-1",
        partnerName: "Ana",
        childrenNames: ["Leo", "Mia"],
        selectedDomainIds: ["dom-1"],
      }),
    ).resolves.toEqual({ success: false, error: "forced child insert failure: Mia" });

    expect(state.families[0].onboarding_step).toBe("pending");
    expect(state.domains[0].is_active).toBe(false);
    expect(state.profiles).toEqual([]);
    randomSpy.mockRestore();
  });

  it("sin pareja: partnerName vacío no crea perfil member", async () => {
    const { admin, state } = createFakeAdminClient({
      families: [{ id: "fam-1", onboarding_step: "pending" }],
      domains: [{ id: "dom-1", family_id: "fam-1", is_active: false }],
      profiles: [],
    });
    mockCreateAdminClient.mockReturnValue(admin);
    const randomSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomSpy.mockReturnValueOnce("p-child-1");

    const { completeOnboardingAction } = await import("@/lib/actions/onboarding");
    await completeOnboardingAction({
      familyId: "fam-1",
      partnerName: " ",
      childrenNames: ["Leo"],
      selectedDomainIds: ["dom-1"],
    });

    expect(state.profiles.some((profile) => profile.role === "member")).toBe(false);
    expect(state.profiles).toEqual([expect.objectContaining({ id: "p-child-1", role: "child", name: "Leo" })]);
    randomSpy.mockRestore();
  });

  it("sin hijos: childrenNames vacío no crea perfiles child", async () => {
    const { admin, state } = createFakeAdminClient({
      families: [{ id: "fam-1", onboarding_step: "pending" }],
      domains: [{ id: "dom-1", family_id: "fam-1", is_active: false }],
      profiles: [],
    });
    mockCreateAdminClient.mockReturnValue(admin);
    const randomSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomSpy.mockReturnValueOnce("p-partner");

    const { completeOnboardingAction } = await import("@/lib/actions/onboarding");
    await completeOnboardingAction({
      familyId: "fam-1",
      partnerName: "Ana",
      childrenNames: [],
      selectedDomainIds: ["dom-1"],
    });

    expect(state.profiles.some((profile) => profile.role === "child")).toBe(false);
    expect(state.profiles).toEqual([expect.objectContaining({ id: "p-partner", role: "member", name: "Ana" })]);
    randomSpy.mockRestore();
  });

  it("dominios inválidos: ids inexistentes no rompen la acción", async () => {
    const { admin, state } = createFakeAdminClient({
      families: [{ id: "fam-1", onboarding_step: "pending" }],
      domains: [{ id: "dom-1", family_id: "fam-1", is_active: false }],
      profiles: [],
    });
    mockCreateAdminClient.mockReturnValue(admin);
    const randomSpy = vi.spyOn(globalThis.crypto, "randomUUID");
    randomSpy.mockReturnValueOnce("p-partner");

    const { completeOnboardingAction } = await import("@/lib/actions/onboarding");
    await expect(
      completeOnboardingAction({
        familyId: "fam-1",
        partnerName: "Ana",
        childrenNames: [],
        selectedDomainIds: ["dom-404"],
      }),
    ).resolves.toEqual({ success: true });

    expect(state.families[0].onboarding_step).toBe("completed");
    expect(state.domains[0].is_active).toBe(false);
    expect(state.profiles).toEqual([expect.objectContaining({ id: "p-partner", role: "member" })]);
    randomSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

type SessionOpts = {
  familyId: string | null;
  onboardingStep?: string | null;
};

function mockSupabaseForSession(session: unknown, opts?: SessionOpts) {
  const familyId = opts && "familyId" in opts ? opts.familyId : "family-1";
  const onboardingStep = opts?.onboardingStep ?? "completed";

  mockCreateServerClient.mockReturnValue({
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            if (table === "profiles") {
              return { data: { family_id: familyId } };
            }
            if (table === "families") {
              return { data: { onboarding_step: onboardingStep } };
            }
            return { data: null };
          }),
        })),
      })),
    })),
  });
}

describe("proxy route protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirige a /login sin sesión en ruta protegida", async () => {
    mockSupabaseForSession(null);
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/dashboard");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("deja pasar /login sin sesión", async () => {
    mockSupabaseForSession(null);
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/login");

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirige a / si hay sesión en /login", async () => {
    mockSupabaseForSession({ user: { id: "u1" } });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/login");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("deja pasar ruta protegida cuando hay sesión y familia", async () => {
    mockSupabaseForSession({ user: { id: "u1" } }, { familyId: "family-1" });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/dashboard");

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sin family_id redirige a /onboarding desde rutas protegidas", async () => {
    mockSupabaseForSession({ user: { id: "u1" } }, { familyId: null });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/dashboard");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/onboarding");
  });

  it("sin family_id permite /onboarding", async () => {
    mockSupabaseForSession({ user: { id: "u1" } }, { familyId: null });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/onboarding");

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("onboarding completado redirige /onboarding a /", async () => {
    mockSupabaseForSession({ user: { id: "u1" } }, { familyId: "f1", onboardingStep: "completed" });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/onboarding");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("onboarding pendiente deja /onboarding", async () => {
    mockSupabaseForSession({ user: { id: "u1" } }, { familyId: "f1", onboardingStep: "pending" });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/onboarding");

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

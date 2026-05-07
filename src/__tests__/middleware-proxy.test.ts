import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCreateServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

function withSession(session: unknown) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
    },
  });
}

describe("proxy route protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("redirige a /login sin sesión en ruta protegida", async () => {
    withSession(null);
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/dashboard");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it("deja pasar /login sin sesión", async () => {
    withSession(null);
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/login");

    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirige a / si hay sesión en /login", async () => {
    withSession({ user: { id: "u1" } });
    const { proxy } = await import("@/proxy");
    const req = new NextRequest("http://localhost/login");

    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});

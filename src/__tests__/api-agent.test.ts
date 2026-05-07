import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/family-context", () => ({
  getScopedFamilyId: vi.fn().mockResolvedValue("8378283a-cfc0-46ec-90c0-07e45c885aee"),
}));

const mockGetAgentMemory = vi.fn();
const mockBuildSystemPrompt = vi.fn(() => "system");
const mockExecuteTool = vi.fn();
const mockApplyGuardrails = vi.fn((plan) => plan);
const mockCreate = vi.fn();

vi.mock("@/lib/kore-db", () => ({
  getAgentMemory: mockGetAgentMemory,
}));

vi.mock("@/lib/agents/orchestrator", () => ({
  allTools: [],
  buildSystemPrompt: mockBuildSystemPrompt,
  executeTool: mockExecuteTool,
}));

vi.mock("@/lib/agent/guardrails", () => ({
  applyGuardrails: mockApplyGuardrails,
}));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

describe("POST /api/agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("devuelve 400 cuando faltan mensaje e imagenes", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const request = { json: vi.fn(async () => ({})) } as never;

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "mensaje o imagenes es obligatorio" });
  });

  it("devuelve 500 si no existe OPENAI_API_KEY", async () => {
    delete process.env.OPENAI_API_KEY;
    const { POST } = await import("@/app/api/agent/route");
    const request = { json: vi.fn(async () => ({ mensaje: "hola" })) } as never;

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Falta OPENAI_API_KEY en el entorno del servidor" });
  });

  it("devuelve 500 si hay error interno", async () => {
    mockGetAgentMemory.mockRejectedValueOnce(new Error("db fail"));
    const { POST } = await import("@/app/api/agent/route");
    const request = { json: vi.fn(async () => ({ mensaje: "hola" })) } as never;

    const res = await POST(request);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error interno del agente" });
  });

  it("devuelve 200 con request válida (mock de OpenAI y Supabase)", async () => {
    mockGetAgentMemory.mockResolvedValueOnce([]);
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Todo OK",
            tool_calls: [],
          },
        },
      ],
    });
    const { POST } = await import("@/app/api/agent/route");
    const request = { json: vi.fn(async () => ({ mensaje: "hola" })) } as never;

    const res = await POST(request);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ reply: "Todo OK", respuesta: "Todo OK" });
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetScopedFamilyId = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/family-context", () => ({
  getScopedFamilyId: mockGetScopedFamilyId,
}));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      audio = { transcriptions: { create: mockCreate } };
    },
  };
});

function audioRequest(): NextRequest {
  const bytes = new Uint8Array(2000);
  const blob = new File([bytes], "audio.webm", { type: "audio/webm" });
  const formData = new FormData();
  formData.append("audio", blob, "audio.webm");
  const request = new NextRequest("http://localhost/api/transcribe", { method: "POST" });
  vi.spyOn(request, "formData").mockResolvedValue(formData);
  return request;
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    mockGetScopedFamilyId.mockResolvedValue("8378283a-cfc0-46ec-90c0-07e45c885aee");
  });

  it("devuelve 401 y no llama a Whisper sin familia", async () => {
    mockGetScopedFamilyId.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/transcribe/route");
    const res = await POST(audioRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "No tienes una familia asignada" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("transcribe el audio cuando hay familia", async () => {
    mockCreate.mockResolvedValueOnce({ text: "hola familia" });
    const { POST } = await import("@/app/api/transcribe/route");
    const res = await POST(audioRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ texto: "hola familia", text: "hola familia" });
    expect(mockGetScopedFamilyId).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

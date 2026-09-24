import { getScopedFamilyId } from "@/lib/family-context";

/** Contrato de las rutas de pago: sin familia no hay sesión válida. */
export const NO_FAMILY_ASSIGNED_ERROR = "No tienes una familia asignada";

export type FamilySessionResult =
  | { ok: true; familyId: string }
  | { ok: false; response: Response };

function unauthorizedFamilyResponse(): Response {
  return new Response(JSON.stringify({ error: NO_FAMILY_ASSIGNED_ERROR }), { status: 401 });
}

/**
 * Misma puerta que ya usaba POST /api/agent: usuario de Supabase con family_id.
 * Las rutas que gastan saldo (agente, Whisper) deben salir aquí antes de llamar a OpenAI.
 */
export async function requireFamilySession(): Promise<FamilySessionResult> {
  const familyId = await getScopedFamilyId();
  if (!familyId) return { ok: false, response: unauthorizedFamilyResponse() };
  return { ok: true, familyId };
}

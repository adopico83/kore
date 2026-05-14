import type { Profile } from "@/lib/kore-db";

/** Contexto fijo por request del agente: familia, miembros y usuario de sesión. */
export type AgentExecutionContext = {
  familyId: string;
  profiles: Profile[];
  /** Usuario autenticado (Supabase); null si no se pudo resolver. */
  currentUserId: string | null;
};

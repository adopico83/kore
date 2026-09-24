import type { KoreServerDbClient, Profile } from "@/lib/kore-db";

/** Contexto fijo por request del agente: familia, miembros, usuario y cliente de sesión. */
export type AgentExecutionContext = {
  familyId: string;
  profiles: Profile[];
  /** Usuario autenticado (Supabase); null si no se pudo resolver. */
  currentUserId: string | null;
  /** Cliente con la cookie del usuario. RLS limita a su familia. */
  db: KoreServerDbClient;
};

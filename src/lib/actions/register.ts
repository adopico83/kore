"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const BASE_DOMAINS = [
  { name: "Compras", agent: "logistica", weight: 8 },
  { name: "Menú", agent: "logistica", weight: 7 },
  { name: "Limpieza", agent: "armonia", weight: 6 },
  { name: "Agenda", agent: "logistica", weight: 9 },
  { name: "Colegio", agent: "logistica", weight: 7 },
  { name: "Economía", agent: "logistica", weight: 6 },
  { name: "Sueño", agent: "armonia", weight: 8 },
  { name: "Ocio", agent: "armonia", weight: 5 },
  { name: "Mantenimiento", agent: "logistica", weight: 4 },
] as const;

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part = (len: number) =>
    Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `KORE-${part(4)}-${part(2)}`;
}

type RegisterFamilyResult = { success: true } | { error: string };

export async function registerFamilyAction(
  email: string,
  password: string,
  familyName: string,
  ownerName: string,
): Promise<RegisterFamilyResult> {
  const admin = createAdminClient();
  let createdUserId: string | null = null;

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFamilyName = familyName.trim();
    const normalizedOwnerName = ownerName.trim();

    const { data: createdUserData, error: createUserError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });

    if (createUserError || !createdUserData.user) {
      return { error: createUserError?.message || "No se pudo crear el usuario." };
    }

    createdUserId = createdUserData.user.id;

    const { data: family, error: familyError } = await admin
      .from("families")
      .insert({
        name: normalizedFamilyName,
        invite_code: generateInviteCode(),
        onboarding_step: "pending",
      })
      .select("id")
      .single();
    console.log("[registerFamilyAction] INSERT families", {
      familyName: normalizedFamilyName,
      familyId: family?.id ?? null,
      error: familyError?.message ?? null,
    });

    if (familyError || !family?.id) {
      throw new Error(familyError?.message || "No se pudo crear la familia.");
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: createdUserId,
      name: normalizedOwnerName,
      family_id: family.id,
      role: "owner",
    });
    console.log("[registerFamilyAction] INSERT profiles owner", {
      ownerId: createdUserId,
      ownerName: normalizedOwnerName,
      familyId: family.id,
      error: profileError?.message ?? null,
    });

    if (profileError) {
      throw new Error(profileError.message || "No se pudo crear el perfil owner.");
    }

    const { error: familyOwnerError } = await admin
      .from("families")
      .update({ owner_id: createdUserId })
      .eq("id", family.id);

    if (familyOwnerError) {
      throw new Error(familyOwnerError.message || "No se pudo asignar owner a la familia.");
    }

    const { error: domainsError } = await admin.from("domains").insert(
      BASE_DOMAINS.map((domain) => ({
        family_id: family.id,
        name: domain.name,
        agent: domain.agent,
        weight: domain.weight,
        is_active: false,
      })),
    );
    console.log("[registerFamilyAction] INSERT domains base", {
      familyId: family.id,
      domainsCount: BASE_DOMAINS.length,
      error: domainsError?.message ?? null,
    });

    // Pareja e hijos no se crean en el registro: se crean durante onboarding.
    console.log("[registerFamilyAction] INSERT profiles pareja", {
      skipped: true,
      reason: "se crean en onboarding",
    });
    console.log("[registerFamilyAction] INSERT profiles hijos", {
      skipped: true,
      reason: "se crean en onboarding",
    });

    if (domainsError) {
      throw new Error(domainsError.message || "No se pudieron crear los dominios base.");
    }

    return { success: true };
  } catch (error) {
    if (createdUserId) {
      await admin.auth.admin.deleteUser(createdUserId);
    }
    return {
      error: error instanceof Error ? error.message : "No se pudo completar el registro.",
    };
  }
}

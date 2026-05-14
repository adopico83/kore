"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { BASE_DOMAINS } from "@/lib/domains-catalog";
import { insertFamilyWithUniqueInvite, parseInviteCodeFromInput } from "@/lib/invite-code";

type RegisterFamilyResult = { success: true } | { error: string };

type RegisterFamilyOptions = {
  inviteCode?: string | null;
};

export async function registerFamilyAction(
  email: string,
  password: string,
  familyName: string,
  ownerName: string,
  options?: RegisterFamilyOptions,
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

    const invite = parseInviteCodeFromInput(options?.inviteCode ?? "");

    if (invite) {
      const { data: familyRow, error: famLookupErr } = await admin.from("families").select("id").eq("invite_code", invite).maybeSingle();
      if (famLookupErr || !familyRow?.id) {
        throw new Error("El código de invitación no es válido.");
      }

      const { error: profileError } = await admin.from("profiles").insert({
        id: createdUserId,
        name: normalizedOwnerName,
        family_id: familyRow.id,
        role: "member",
      });
      if (profileError) {
        throw new Error(profileError.message || "No se pudo crear el perfil.");
      }

      return { success: true };
    }

    const inserted = await insertFamilyWithUniqueInvite(admin, normalizedFamilyName);
    if ("error" in inserted) {
      throw new Error(inserted.error);
    }
    const family = { id: inserted.id };

    const { error: profileError } = await admin.from("profiles").insert({
      id: createdUserId,
      name: normalizedOwnerName,
      family_id: family.id,
      role: "owner",
    });
    if (profileError) {
      throw new Error(profileError.message || "No se pudo crear el perfil owner.");
    }

    const { error: familyOwnerError } = await admin.from("families").update({ owner_id: createdUserId }).eq("id", family.id);
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

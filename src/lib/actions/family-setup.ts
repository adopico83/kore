"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BASE_DOMAINS } from "@/lib/domains-catalog";
import { insertFamilyWithUniqueInvite, parseInviteCodeFromInput } from "@/lib/invite-code";

type Ok = { success: true; familyId: string };
type Err = { success: false; error: string };

/** Usuario autenticado sin `family_id`: crea hogar, dominios base y perfil owner. */
export async function createFamilyForCurrentUserAction(
  familyDisplayName: string,
  ownerDisplayName: string,
): Promise<Ok | Err> {
  const name = familyDisplayName.trim();
  const ownerName = ownerDisplayName.trim();
  if (!name) return { success: false, error: "El nombre de la familia es obligatorio." };
  if (!ownerName) return { success: false, error: "Tu nombre es obligatorio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "No hay sesión activa." };

  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin.from("profiles").select("id,family_id").eq("id", user.id).maybeSingle();
  if (readErr) {
    return { success: false, error: readErr.message || "No se pudo leer el perfil." };
  }
  if (existing?.family_id) {
    return { success: false, error: "Ya perteneces a una familia." };
  }

  const inserted = await insertFamilyWithUniqueInvite(admin, name);
  if ("error" in inserted) {
    return { success: false, error: inserted.error };
  }
  const familyId = inserted.id;

  if (existing?.id) {
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        name: ownerName,
        family_id: familyId,
        role: "owner",
      })
      .eq("id", user.id);
    if (upErr) {
      await admin.from("families").delete().eq("id", familyId);
      return { success: false, error: upErr.message || "No se pudo actualizar el perfil." };
    }
  } else {
    const { error: insErr } = await admin.from("profiles").insert({
      id: user.id,
      name: ownerName,
      family_id: familyId,
      role: "owner",
    });
    if (insErr) {
      await admin.from("families").delete().eq("id", familyId);
      return { success: false, error: insErr.message || "No se pudo crear el perfil." };
    }
  }

  const { error: ownErr } = await admin.from("families").update({ owner_id: user.id }).eq("id", familyId);
  if (ownErr) {
    return { success: false, error: ownErr.message || "No se pudo asignar el propietario." };
  }

  const { error: domErr } = await admin.from("domains").insert(
    BASE_DOMAINS.map((domain) => ({
      family_id: familyId,
      name: domain.name,
      agent: domain.agent,
      weight: domain.weight,
      is_active: false,
    })),
  );
  if (domErr) {
    return { success: false, error: domErr.message || "No se pudieron crear los dominios base." };
  }

  return { success: true, familyId };
}

/** Usuario autenticado sin familia: se une con código de invitación (rol member). */
export async function joinFamilyWithInviteForCurrentUserAction(
  inviteRaw: string,
  memberDisplayName: string,
): Promise<Ok | Err> {
  const code = parseInviteCodeFromInput(inviteRaw);
  const memberName = memberDisplayName.trim();
  if (!code) return { success: false, error: "Código de invitación no válido." };
  if (!memberName) return { success: false, error: "Tu nombre es obligatorio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { success: false, error: "No hay sesión activa." };

  const admin = createAdminClient();

  const { data: existing, error: readErr } = await admin.from("profiles").select("id,family_id").eq("id", user.id).maybeSingle();
  if (readErr) {
    return { success: false, error: readErr.message || "No se pudo leer el perfil." };
  }
  if (existing?.family_id) {
    return { success: false, error: "Ya perteneces a una familia." };
  }

  const { data: family, error: famErr } = await admin.from("families").select("id").eq("invite_code", code).maybeSingle();
  if (famErr || !family?.id) {
    return { success: false, error: "No encontramos una familia con ese código." };
  }

  if (existing?.id) {
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        name: memberName,
        family_id: family.id,
        role: "member",
      })
      .eq("id", user.id);
    if (upErr) {
      return { success: false, error: upErr.message || "No se pudo unir a la familia." };
    }
  } else {
    const { error: insErr } = await admin.from("profiles").insert({
      id: user.id,
      name: memberName,
      family_id: family.id,
      role: "member",
    });
    if (insErr) {
      return { success: false, error: insErr.message || "No se pudo crear el perfil." };
    }
  }

  return { success: true, familyId: family.id };
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";

type CompleteOnboardingInput = {
  familyId: string;
  partnerName: string;
  childrenNames: string[];
  selectedDomainIds: string[];
};

/** Valores permitidos por `profiles_role_check` en DB: exactamente estos literales. */
const PROFILE_ROLE_MEMBER = "member" as const;
const PROFILE_ROLE_CHILD = "child" as const;

type ProfileInsertRole = typeof PROFILE_ROLE_MEMBER | typeof PROFILE_ROLE_CHILD;

type ProfileSnapshot = {
  id: string;
  name: string;
  role: string | null;
  family_id: string | null;
};

type CompleteOnboardingResult = { success: true } | { success: false; error: string };

export async function completeOnboardingAction({
  familyId,
  partnerName,
  childrenNames,
  selectedDomainIds,
}: CompleteOnboardingInput): Promise<CompleteOnboardingResult> {
  console.log("[completeOnboardingAction] start", {
    familyId,
    partnerName,
    childrenNames,
    selectedDomainIds,
  });

  const normalizedFamilyId = familyId.trim();
  if (!normalizedFamilyId) {
    return { success: false, error: "familyId es obligatorio." };
  }

  if (!Array.isArray(childrenNames)) {
    return { success: false, error: "childrenNames debe ser string[] válido." };
  }

  if (!childrenNames.every((name) => typeof name === "string")) {
    return { success: false, error: "childrenNames contiene valores no válidos." };
  }

  const normalizedPartnerName = partnerName.trim();
  const normalizedChildren = Array.from(
    new Set(childrenNames.map((name) => name.trim()).filter(Boolean)),
  );
  const normalizedDomainIds = Array.from(new Set(selectedDomainIds.map((id) => id.trim()).filter(Boolean)));

  const profileTargets: Array<{ name: string; role: ProfileInsertRole }> = [];
  if (normalizedPartnerName) {
    profileTargets.push({ name: normalizedPartnerName, role: PROFILE_ROLE_MEMBER });
  }
  for (const childName of normalizedChildren) {
    profileTargets.push({ name: childName, role: PROFILE_ROLE_CHILD });
  }

  const admin = createAdminClient();
  const rollbackState: {
    previousOnboardingStep?: string | null;
    domainStates: Array<{ id: string; is_active: boolean | null }>;
    validDomainIds: string[];
    createdProfileIds: string[];
    updatedProfiles: ProfileSnapshot[];
  } = {
    domainStates: [],
    validDomainIds: [],
    createdProfileIds: [],
    updatedProfiles: [],
  };

  try {
    const { data: familyRow, error: familySelectError } = await admin
      .from("families")
      .select("onboarding_step")
      .eq("id", normalizedFamilyId)
      .single();

    if (familySelectError || !familyRow) {
      console.error("[completeOnboardingAction] families.select error", familySelectError);
      throw new Error(familySelectError?.message || "No se pudo cargar la familia.");
    }

    rollbackState.previousOnboardingStep = familyRow.onboarding_step ?? null;

    if (normalizedDomainIds.length > 0) {
      const { data: existingDomains, error: domainsSelectError } = await admin
        .from("domains")
        .select("id,is_active")
        .eq("family_id", normalizedFamilyId)
        .in("id", normalizedDomainIds);

      if (domainsSelectError) {
        console.error("[completeOnboardingAction] domains.select error", domainsSelectError);
        throw new Error(domainsSelectError.message || "No se pudieron leer los dominios seleccionados.");
      }

      const safeDomains = existingDomains ?? [];
      rollbackState.domainStates = safeDomains;
      rollbackState.validDomainIds = safeDomains.map((domain) => domain.id);
    }

    const { error: familyUpdateError } = await admin
      .from("families")
      .update({ onboarding_step: "completed" })
      .eq("id", normalizedFamilyId);

    if (familyUpdateError) {
      console.error("[completeOnboardingAction] families.update error", familyUpdateError);
      throw new Error(familyUpdateError.message || "No se pudo completar el onboarding en la familia.");
    }

    if (profileTargets.length > 0) {
      const targetNames = Array.from(new Set(profileTargets.map((target) => target.name)));
      const targetRoles = Array.from(new Set(profileTargets.map((target) => target.role)));

      const { data: existingProfiles, error: existingProfilesError } = await admin
        .from("profiles")
        .select("id,name,role,family_id")
        .eq("family_id", normalizedFamilyId)
        .in("name", targetNames)
        .in("role", targetRoles);

      if (existingProfilesError) {
        console.error("[completeOnboardingAction] profiles.select error", existingProfilesError);
        throw new Error(existingProfilesError.message || "No se pudieron comprobar perfiles existentes.");
      }

      const byRoleAndName = new Map<string, ProfileSnapshot>();
      for (const row of existingProfiles ?? []) {
        byRoleAndName.set(`${row.role ?? ""}::${row.name}`, row);
      }

      for (const target of profileTargets) {
        const key = `${target.role}::${target.name}`;
        const existing = byRoleAndName.get(key);

        if (existing) {
          rollbackState.updatedProfiles.push({
            id: existing.id,
            name: existing.name,
            role: existing.role,
            family_id: existing.family_id,
          });

          const roleForUpdate: ProfileInsertRole =
            target.role === PROFILE_ROLE_MEMBER ? PROFILE_ROLE_MEMBER : PROFILE_ROLE_CHILD;

          const { error: updateProfileError } = await admin
            .from("profiles")
            .update({
              name: target.name,
              role: roleForUpdate,
              family_id: normalizedFamilyId,
            })
            .eq("id", existing.id);

          if (updateProfileError) {
            console.error("[completeOnboardingAction] profiles.update error", updateProfileError, {
              profileId: existing.id,
              role: target.role,
              name: target.name,
            });
            throw new Error(updateProfileError.message || "No se pudo actualizar un perfil.");
          }
          continue;
        }

        const createdId = crypto.randomUUID();
        const roleForInsert: ProfileInsertRole =
          target.role === PROFILE_ROLE_MEMBER ? PROFILE_ROLE_MEMBER : PROFILE_ROLE_CHILD;

        const { error: insertProfileError } = await admin.from("profiles").insert({
          id: createdId,
          name: target.name,
          family_id: normalizedFamilyId,
          role: roleForInsert,
        });

        if (insertProfileError) {
          console.error("[completeOnboardingAction] profiles.insert error", insertProfileError, {
            role: target.role,
            name: target.name,
          });
          throw new Error(insertProfileError.message || "No se pudo crear un perfil.");
        }
        rollbackState.createdProfileIds.push(createdId);
      }
    }

    if (rollbackState.validDomainIds.length > 0) {
      const { error: domainUpdateError } = await admin
        .from("domains")
        .update({ is_active: true })
        .eq("family_id", normalizedFamilyId)
        .in("id", rollbackState.validDomainIds);

      if (domainUpdateError) {
        console.error("[completeOnboardingAction] domains.update error", domainUpdateError);
        throw new Error(domainUpdateError.message || "No se pudieron activar dominios.");
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[completeOnboardingAction] catch", error);
    if (rollbackState.createdProfileIds.length > 0) {
      const { error: rollbackDeleteProfilesError } = await admin
        .from("profiles")
        .delete()
        .in("id", rollbackState.createdProfileIds);
      if (rollbackDeleteProfilesError) {
        console.error("[completeOnboardingAction] rollback profiles.delete error", rollbackDeleteProfilesError);
      }
    }

    for (const snapshot of rollbackState.updatedProfiles) {
      const { error: rollbackUpdateProfilesError } = await admin
        .from("profiles")
        .update({
          name: snapshot.name,
          role: snapshot.role,
          family_id: snapshot.family_id,
        })
        .eq("id", snapshot.id);
      if (rollbackUpdateProfilesError) {
        console.error("[completeOnboardingAction] rollback profiles.update error", rollbackUpdateProfilesError, {
          profileId: snapshot.id,
        });
      }
    }

    for (const domain of rollbackState.domainStates) {
      const { error: rollbackDomainsError } = await admin
        .from("domains")
        .update({ is_active: domain.is_active })
        .eq("id", domain.id);
      if (rollbackDomainsError) {
        console.error("[completeOnboardingAction] rollback domains.update error", rollbackDomainsError, {
          domainId: domain.id,
        });
      }
    }

    if (rollbackState.previousOnboardingStep !== undefined) {
      const { error: rollbackFamilyError } = await admin
        .from("families")
        .update({ onboarding_step: rollbackState.previousOnboardingStep })
        .eq("id", normalizedFamilyId);
      if (rollbackFamilyError) {
        console.error("[completeOnboardingAction] rollback families.update error", rollbackFamilyError, {
          familyId: normalizedFamilyId,
        });
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "No se pudo completar el onboarding.",
    };
  }
}

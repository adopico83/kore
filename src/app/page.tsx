export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { HomeClient } from "./HomeClient";
import { getScopedFamilyId } from "@/lib/family-context";
import { createClient } from "@/lib/supabase/server";
import {
  getProfiles,
  getDomains,
  getCalendarEvents,
  getExpenses,
  getHealthRecords,
  getKoreNotes,
  getShoppingItems,
  getPendingCleaningTasks,
  getWeeklyMenu,
  getSleepSessions,
  getSchoolEvents,
  type Profile,
} from "@/lib/kore-db";
import { createAdminClient } from "@/lib/supabase/admin";

/** True si algún adulto distinto del owner tiene `profiles.id` presente en `auth.users`. */
async function computePartnerHasAuthAccount(profiles: Profile[]): Promise<boolean> {
  const ownerId = profiles.find((p) => p.role === "owner")?.id?.trim() ?? "";
  if (!ownerId) return false;

  const otherAdults = profiles.filter((p) => p.role !== "child" && p.id !== ownerId);
  if (otherAdults.length === 0) return false;

  const admin = createAdminClient();
  for (const p of otherAdults) {
    const { data, error } = await admin.auth.admin.getUserById(p.id);
    if (!error && data?.user) return true;
  }
  return false;
}

export default async function Home() {
  console.log("PAGE.TSX EJECUTÁNDOSE");
  const supabase = await createClient();
  let familyName = "";
  let initialInviteCode: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("AUTH USER EN PAGE:", user?.id ?? "NULL");

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .single();

    if (profile?.family_id) {
      const { data: family } = await supabase
        .from("families")
        .select("onboarding_step, name, invite_code")
        .eq("id", profile.family_id)
        .single();
      familyName = family?.name ?? "";
      const rawInvite = family?.invite_code;
      initialInviteCode = typeof rawInvite === "string" && rawInvite.trim() ? rawInvite.trim() : null;

      console.log("USER:", user?.id);
      console.log("PROFILE:", profile);
      console.log("FAMILY:", family);
      console.log("ONBOARDING STEP:", family?.onboarding_step);
      console.log("FAMILY ONBOARDING:", family?.onboarding_step);

      if (family?.onboarding_step === "pending") {
        redirect("/onboarding");
      }
    }
  }

  const familyId = await getScopedFamilyId();

  if (!familyId) {
    return (
      <HomeClient
        currentUserId={user?.id ?? ""}
        familyName={familyName}
        initialInviteCode={initialInviteCode}
        partnerHasAuthAccount={false}
        initialProfiles={[]}
        initialDomains={[]}
        initialCalendarEvents={[]}
        initialExpenses={[]}
        initialHealthRecords={[]}
        initialKoreNotes={[]}
        initialShoppingItems={[]}
        initialPendingCleaningTasks={[]}
        initialWeeklyMenu={[]}
        initialSleepSessions={[]}
        initialSchoolEvents={[]}
      />
    );
  }

  const admin = createAdminClient();
  const [
    initialProfiles,
    initialDomainsAll,
    initialCalendarEvents,
    initialExpenses,
    initialHealthRecords,
    allKoreNotes,
    initialShoppingItems,
    initialPendingCleaningTasks,
    initialWeeklyMenu,
    initialSleepSessions,
    initialSchoolEvents,
  ] = await Promise.all([
    getProfiles(familyId),
    getDomains(familyId),
    getCalendarEvents(familyId),
    getExpenses(familyId),
    getHealthRecords(familyId),
    getKoreNotes(familyId),
    getShoppingItems(familyId),
    getPendingCleaningTasks(admin, familyId),
    getWeeklyMenu(familyId),
    getSleepSessions(admin, familyId, 14),
    getSchoolEvents(admin, familyId),
  ]);

  const initialDomains = initialDomainsAll.filter((domain) => domain.is_active === true);
  const initialKoreNotes = allKoreNotes.slice(0, 3);

  let partnerHasAuthAccount = false;
  try {
    partnerHasAuthAccount = await computePartnerHasAuthAccount(initialProfiles);
  } catch {
    partnerHasAuthAccount = false;
  }

  return (
    <HomeClient
      currentUserId={user?.id ?? ""}
      familyName={familyName}
      initialInviteCode={initialInviteCode}
      partnerHasAuthAccount={partnerHasAuthAccount}
      initialProfiles={initialProfiles}
      initialDomains={initialDomains}
      initialCalendarEvents={initialCalendarEvents}
      initialExpenses={initialExpenses}
      initialHealthRecords={initialHealthRecords}
      initialKoreNotes={initialKoreNotes}
      initialShoppingItems={initialShoppingItems}
      initialPendingCleaningTasks={initialPendingCleaningTasks}
      initialWeeklyMenu={initialWeeklyMenu}
      initialSleepSessions={initialSleepSessions}
      initialSchoolEvents={initialSchoolEvents}
    />
  );
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { HomeClient } from "./HomeClient";
import { getScopedIdentity } from "@/lib/family-context";
import { createClient } from "@/lib/supabase/server";
import {
  getProfiles,
  getDomains,
  getCalendarEvents,
  getExpenses,
  getHealthRecords,
  getCorchoPhotoUrlsByNote,
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
  const checks = await Promise.all(
    otherAdults.map(async (profile) => {
      const { data, error } = await admin.auth.admin.getUserById(profile.id);
      return !error && Boolean(data?.user);
    }),
  );
  return checks.some(Boolean);
}

export default async function Home() {
  const identity = await getScopedIdentity();
  const userId = identity.userId ?? "";
  const familyId = identity.familyId;

  if (!familyId) {
    return (
      <HomeClient
        currentUserId={userId}
        familyName=""
        initialInviteCode={null}
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

  const supabase = await createClient();
  const familyQuery = supabase
    .from("families")
    .select("onboarding_step, name, invite_code")
    .eq("id", familyId)
    .single();

  const [familyResult, domainData] = await Promise.all([
    familyQuery,
    Promise.all([
      getProfiles(supabase, familyId),
      getDomains(supabase, familyId),
      getCalendarEvents(supabase, familyId),
      getExpenses(supabase, familyId),
      getHealthRecords(supabase, familyId),
      getKoreNotes(supabase, familyId),
      getShoppingItems(supabase, familyId),
      getPendingCleaningTasks(supabase, familyId),
      getWeeklyMenu(supabase, familyId),
      getSleepSessions(supabase, familyId, 14),
      getSchoolEvents(supabase, familyId),
    ]),
  ]);

  const family = familyResult.data;
  if (family?.onboarding_step === "pending") {
    redirect("/onboarding");
  }

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
  ] = domainData;

  const initialDomains = initialDomainsAll.filter((domain) => domain.is_active === true);
  const latestNotes = allKoreNotes.slice(0, 3);
  const rawInvite = family?.invite_code;
  const initialInviteCode = typeof rawInvite === "string" && rawInvite.trim() ? rawInvite.trim() : null;

  const [photoUrls, partnerHasAuthAccount] = await Promise.all([
    getCorchoPhotoUrlsByNote(
      supabase,
      familyId,
      latestNotes.map((note) => note.id),
    ),
    computePartnerHasAuthAccount(initialProfiles).catch(() => false),
  ]);
  const initialKoreNotes = latestNotes.map((note) => ({
    ...note,
    imageUrls: photoUrls[note.id] ?? [],
  }));

  return (
    <HomeClient
      currentUserId={userId}
      familyName={family?.name ?? ""}
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

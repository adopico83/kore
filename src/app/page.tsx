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
  getSleepLogs,
} from "@/lib/kore-db";

export default async function Home() {
  console.log("PAGE.TSX EJECUTÁNDOSE");
  const supabase = await createClient();
  let familyName = "";
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
        .select("onboarding_step, name")
        .eq("id", profile.family_id)
        .single();
      familyName = family?.name ?? "";

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
        initialProfiles={[]}
        initialDomains={[]}
        initialCalendarEvents={[]}
        initialExpenses={[]}
        initialHealthRecords={[]}
        initialKoreNotes={[]}
        initialShoppingItems={[]}
        initialPendingCleaningTasks={[]}
        initialWeeklyMenu={[]}
        initialSleepLogs={[]}
      />
    );
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
    initialSleepLogs,
  ] = await Promise.all([
    getProfiles(familyId),
    getDomains(familyId),
    getCalendarEvents(familyId),
    getExpenses(familyId),
    getHealthRecords(familyId),
    getKoreNotes(familyId),
    getShoppingItems(familyId),
    getPendingCleaningTasks(familyId),
    getWeeklyMenu(familyId),
    getSleepLogs(familyId, 7),
  ]);

  const initialDomains = initialDomainsAll.filter((domain) => domain.is_active === true);
  const initialKoreNotes = allKoreNotes.slice(0, 3);

  return (
    <HomeClient
      currentUserId={user?.id ?? ""}
      familyName={familyName}
      initialProfiles={initialProfiles}
      initialDomains={initialDomains}
      initialCalendarEvents={initialCalendarEvents}
      initialExpenses={initialExpenses}
      initialHealthRecords={initialHealthRecords}
      initialKoreNotes={initialKoreNotes}
      initialShoppingItems={initialShoppingItems}
      initialPendingCleaningTasks={initialPendingCleaningTasks}
      initialWeeklyMenu={initialWeeklyMenu}
      initialSleepLogs={initialSleepLogs}
    />
  );
}

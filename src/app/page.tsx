export const dynamic = "force-dynamic";

import { HomeClient } from "./HomeClient";
import { getScopedFamilyId } from "@/lib/family-context";
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
  const familyId = await getScopedFamilyId();

  if (!familyId) {
    return (
      <HomeClient
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
    initialDomains,
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

  const initialKoreNotes = allKoreNotes.slice(0, 3);

  return (
    <HomeClient
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

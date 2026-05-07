"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addDomainHistory as dbAddDomainHistory,
  getDomainHistory as dbGetDomainHistory,
  getDomains as dbGetDomains,
  updateDomain as dbUpdateDomain,
  type Domain,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getDomains() {
  const familyId = await requireFamilyId();
  return dbGetDomains(familyId);
}

export async function updateDomain(id: string, data: Partial<Domain>) {
  const familyId = await requireFamilyId();
  return dbUpdateDomain(familyId, id, data);
}

export async function addDomainHistory(domainId: string, text: string, createdBy: string) {
  const familyId = await requireFamilyId();
  return dbAddDomainHistory(familyId, domainId, text, createdBy);
}

export async function getDomainHistory(domainId: string) {
  const familyId = await requireFamilyId();
  return dbGetDomainHistory(familyId, domainId);
}

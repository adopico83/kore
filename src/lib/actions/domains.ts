"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  activateDomain as dbActivateDomain,
  addDomainHistory as dbAddDomainHistory,
  createCustomDomain as dbCreateCustomDomain,
  deactivateDomain as dbDeactivateDomain,
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

export async function activateDomain(domainId: string) {
  const familyId = await requireFamilyId();
  return dbActivateDomain(familyId, domainId);
}

export async function deactivateDomain(domainId: string) {
  const familyId = await requireFamilyId();
  return dbDeactivateDomain(familyId, domainId);
}

export async function createCustomDomain(name: string, emoji: string) {
  const familyId = await requireFamilyId();
  return dbCreateCustomDomain(familyId, { name, emoji });
}

export async function addDomainHistory(domainId: string, text: string, createdBy: string) {
  const familyId = await requireFamilyId();
  return dbAddDomainHistory(familyId, domainId, text, createdBy);
}

export async function getDomainHistory(domainId: string) {
  const familyId = await requireFamilyId();
  return dbGetDomainHistory(familyId, domainId);
}

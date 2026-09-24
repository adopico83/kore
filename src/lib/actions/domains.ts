"use server";

import { requireFamilyDb } from "@/lib/family-db";
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

export async function getDomains() {
  const { familyId, client } = await requireFamilyDb();
  return dbGetDomains(client, familyId);
}

export async function updateDomain(id: string, data: Partial<Domain>) {
  const { familyId, client } = await requireFamilyDb();
  return dbUpdateDomain(client, familyId, id, data);
}

export async function activateDomain(domainId: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbActivateDomain(client, familyId, domainId);
}

export async function deactivateDomain(domainId: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbDeactivateDomain(client, familyId, domainId);
}

export async function createCustomDomain(name: string, emoji: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbCreateCustomDomain(client, familyId, { name, emoji });
}

export async function addDomainHistory(domainId: string, text: string, createdBy: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbAddDomainHistory(client, familyId, domainId, text, createdBy);
}

export async function getDomainHistory(domainId: string) {
  const { familyId, client } = await requireFamilyDb();
  return dbGetDomainHistory(client, familyId, domainId);
}

"use server";

import { getScopedFamilyId } from "@/lib/family-context";
import {
  addSchoolEvent as dbAddSchoolEvent,
  addSchoolMaterial as dbAddSchoolMaterial,
  completeSchoolMaterial as dbCompleteSchoolMaterial,
  deleteSchoolItem as dbDeleteSchoolItem,
  getSchoolEvents as dbGetSchoolEvents,
  getSchoolMaterials as dbGetSchoolMaterials,
} from "@/lib/kore-db";

async function requireFamilyId(): Promise<string> {
  const familyId = await getScopedFamilyId();
  if (!familyId) throw new Error("No family context");
  return familyId;
}

export async function getSchoolEvents() {
  const familyId = await requireFamilyId();
  return dbGetSchoolEvents(familyId);
}

export async function addSchoolEvent(data: {
  title: string;
  date: string;
  time?: string;
  type?: string;
  description?: string;
}) {
  const familyId = await requireFamilyId();
  return dbAddSchoolEvent(familyId, data);
}

export async function getSchoolMaterials() {
  const familyId = await requireFamilyId();
  return dbGetSchoolMaterials(familyId);
}

export async function addSchoolMaterial(data: { item: string; urgency?: string }) {
  const familyId = await requireFamilyId();
  return dbAddSchoolMaterial(familyId, data);
}

export async function completeSchoolMaterial(id: string) {
  const familyId = await requireFamilyId();
  return dbCompleteSchoolMaterial(familyId, id);
}

export async function deleteSchoolItem(id: string, type: "event" | "material") {
  const familyId = await requireFamilyId();
  return dbDeleteSchoolItem(familyId, id, type);
}

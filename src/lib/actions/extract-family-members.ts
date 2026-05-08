"use server";

import { extractFamilyMembers } from "@/lib/ai/name-parser";

export type ParsedFamilyPeople = {
  partnerName: string;
  childrenNames: string[];
};

/**
 * Parsea nombres en servidor (OpenAI + fallback). Ignora `owner` devuelto por el modelo:
 * el owner ya está en `profiles` desde el registro.
 */
export async function parseFamilyPeopleForOnboarding(raw: string): Promise<ParsedFamilyPeople> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { partnerName: "", childrenNames: [] };
  }

  const { partner, children } = await extractFamilyMembers(trimmed);

  const partnerName = partner?.trim() ?? "";
  const childrenNames = Array.from(
    new Set(children.map((c) => String(c).trim()).filter(Boolean)),
  );

  return { partnerName, childrenNames };
}

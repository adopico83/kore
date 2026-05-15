"use server";

import { getScopedFamilyId, getScopedUserId } from "@/lib/family-context";
import { deleteSubscription, saveSubscription, type PushSubscriptionJSON } from "@/lib/kore-db";

export async function subscribeToNotificationsAction(
  subscription: PushSubscriptionJSON,
  deviceType?: string | null,
) {
  const familyId = await getScopedFamilyId();
  const userId = await getScopedUserId();
  if (!familyId || !userId) throw new Error("No hay sesión o familia.");
  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) throw new Error("Suscripción inválida.");
  return saveSubscription(userId, familyId, { endpoint, keys: { p256dh, auth } }, deviceType ?? null);
}

export async function unsubscribeFromNotificationsAction() {
  const userId = await getScopedUserId();
  if (!userId) throw new Error("No hay sesión.");
  await deleteSubscription(userId);
}

"use server";

import { getScopedUserId } from "@/lib/family-context";
import { requireFamilyDb } from "@/lib/family-db";
import { deleteSubscription, saveSubscription, type PushSubscriptionJSON } from "@/lib/kore-db";

export async function subscribeToNotificationsAction(
  subscription: PushSubscriptionJSON,
  deviceType?: string | null,
) {
  const { familyId, client } = await requireFamilyDb();
  const userId = await getScopedUserId();
  if (!userId) throw new Error("No hay sesión o familia.");

  const endpoint = subscription?.endpoint?.trim() ?? "";
  const p256dh = subscription?.keys?.p256dh?.trim() ?? "";
  const auth = subscription?.keys?.auth?.trim() ?? "";

  if (!endpoint || !p256dh || !auth) {
    console.error("[push] Intento de suscripción inválida bloqueado.");
    throw new Error("Suscripción inválida.");
  }

  return saveSubscription(
    client,
    userId,
    familyId,
    { endpoint, keys: { p256dh, auth } },
    deviceType ?? null,
  );
}

export async function unsubscribeFromNotificationsAction() {
  const { client } = await requireFamilyDb();
  const userId = await getScopedUserId();
  if (!userId) throw new Error("No hay sesión.");
  await deleteSubscription(client, userId);
}

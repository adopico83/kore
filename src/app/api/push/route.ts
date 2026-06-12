import webpush from "web-push";
import { NextResponse } from "next/server";

import {
  buildFallbackDailySummaryMessage,
  fetchDailySummaryContext,
  generateDailySummaryMessage,
  hasRelevantDailySummary,
} from "@/lib/push-daily-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { listFamilyIdsWithPushSubscriptions, parseSubscriptionDataToWebPush } from "@/lib/kore-db";

type PushBody = {
  familyId?: string;
  title?: string;
  body?: string;
  url?: string;
};

type PushPayload = { title: string; body: string; url: string };

type SendResult = { sent: number; removed: number; total: number };

function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
    return (err as { statusCode: number }).statusCode;
  }
  return 0;
}

async function sendPushToFamily(
  admin: ReturnType<typeof createAdminClient>,
  familyId: string,
  message: PushPayload,
): Promise<SendResult> {
  const { data: rows, error } = await admin.from("push_subscriptions").select("*").eq("family_id", familyId);
  if (error) throw new Error(error.message);

  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url });
  let sent = 0;
  let removed = 0;

  for (const row of rows ?? []) {
    const parsed = parseSubscriptionDataToWebPush(row.subscription_data as Json);
    if (!parsed) continue;
    const pushSub = { endpoint: parsed.endpoint, keys: parsed.keys };
    try {
      await webpush.sendNotification(pushSub, payload, { TTL: 86_400 });
      sent += 1;
    } catch (err) {
      console.error(`[api/push] sendNotification failed for row ${row.id}`);
      const code = getStatusCode(err);
      if (code === 410 || code === 404) {
        const { error: delErr } = await admin.from("push_subscriptions").delete().eq("id", row.id);
        if (!delErr) removed += 1;
      }
    }
  }

  return { sent, removed, total: (rows ?? []).length };
}

async function handleDailySummary(admin: ReturnType<typeof createAdminClient>) {
  const familyIds = await listFamilyIdsWithPushSubscriptions(admin);
  let sent = 0;
  let removed = 0;
  let skipped = 0;
  let notified = 0;

  for (const familyId of familyIds) {
    const ctx = await fetchDailySummaryContext(admin, familyId);
    if (!hasRelevantDailySummary(ctx)) {
      skipped += 1;
      continue;
    }

    let body: string;
    try {
      body = await generateDailySummaryMessage(ctx);
    } catch (err) {
      console.error(`[api/push] GPT daily-summary failed for ${familyId}`, err);
      body = buildFallbackDailySummaryMessage(ctx);
    }

    const title = `Buenos días, ${ctx.familyName}`;
    const result = await sendPushToFamily(admin, familyId, { title, body, url: "/" });
    sent += result.sent;
    removed += result.removed;
    if (result.sent > 0) notified += 1;
  }

  return NextResponse.json({
    ok: true,
    mode: "daily-summary",
    families: familyIds.length,
    notified,
    skipped,
    sent,
    removed,
  });
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID no configurado" }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://kore-kappa-eight.vercel.app",
    publicKey,
    privateKey,
  );

  let json: PushBody;
  try {
    json = (await req.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const familyIdRaw = typeof json.familyId === "string" ? json.familyId.trim() : "";
  if (!familyIdRaw) {
    return NextResponse.json({ error: "familyId obligatorio" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (familyIdRaw === "all") {
    return handleDailySummary(admin);
  }

  const title = typeof json.title === "string" && json.title.trim() ? json.title.trim() : "Kore";
  const bodyText = typeof json.body === "string" ? json.body : "";
  const openUrl = typeof json.url === "string" && json.url.trim() ? json.url.trim() : "/";

  try {
    const result = await sendPushToFamily(admin, familyIdRaw, { title, body: bodyText, url: openUrl });
    return NextResponse.json({ ok: true, sent: result.sent, removed: result.removed, total: result.total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar push";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

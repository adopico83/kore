import webpush from "web-push";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { parseSubscriptionDataToWebPush } from "@/lib/kore-db";

type PushBody = {
  familyId?: string;
  title?: string;
  body?: string;
  url?: string;
};

function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err && typeof (err as { statusCode: unknown }).statusCode === "number") {
    return (err as { statusCode: number }).statusCode;
  }
  return 0;
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:kore@localhost";

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "VAPID no configurado" }, { status: 500 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let json: PushBody;
  try {
    json = (await req.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const familyId = typeof json.familyId === "string" ? json.familyId.trim() : "";
  if (!familyId) {
    return NextResponse.json({ error: "familyId obligatorio" }, { status: 400 });
  }

  const title = typeof json.title === "string" && json.title.trim() ? json.title.trim() : "Kore";
  const bodyText = typeof json.body === "string" ? json.body : "";
  const openUrl = typeof json.url === "string" && json.url.trim() ? json.url.trim() : "/";

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("push_subscriptions").select("*").eq("family_id", familyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({ title, body: bodyText, url: openUrl });
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
      const code = getStatusCode(err);
      if (code === 410 || code === 404) {
        const { error: delErr } = await admin.from("push_subscriptions").delete().eq("id", row.id);
        if (!delErr) removed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, removed, total: (rows ?? []).length });
}

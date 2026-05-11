import { createAdminClient } from "@/lib/supabase/admin";

const PUSHOVER_MESSAGES_URL = "https://api.pushover.net/1/messages.json";

const MS_24H = 24 * 60 * 60 * 1000;

export interface KoreNotification {
  message: string;
  urgency: "alta" | "media" | "baja";
  type: string;
  slug: string;
}

const priorityByUrgency: Record<KoreNotification["urgency"], number> = {
  alta: 1,
  media: 0,
  baja: -1,
};

type PushoverResponse = {
  status?: number;
};

export async function sendKoreNotification(notification: KoreNotification): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pushoverToken = process.env.PUSHOVER_API_TOKEN;
  const pushoverUser = process.env.PUSHOVER_USER_KEY;

  if (!supabaseUrl || !serviceRoleKey || !pushoverToken || !pushoverUser) {
    return false;
  }

  const supabase = createAdminClient();
  const since = new Date(Date.now() - MS_24H).toISOString();

  const { data: recent, error: lookupError } = await supabase
    .from("kore_notifications")
    .select("id")
    .eq("slug", notification.slug)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (lookupError || recent) {
    return false;
  }

  const body = new URLSearchParams({
    token: pushoverToken,
    user: pushoverUser,
    message: notification.message,
    title: "🏠 Kore",
    priority: String(priorityByUrgency[notification.urgency]),
  });

  let pushoverRes: Response;
  try {
    pushoverRes = await fetch(PUSHOVER_MESSAGES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return false;
  }

  let parsed: PushoverResponse;
  try {
    parsed = (await pushoverRes.json()) as PushoverResponse;
  } catch {
    return false;
  }

  if (parsed.status !== 1) {
    return false;
  }

  const { error: insertError } = await supabase.from("kore_notifications").insert({
    slug: notification.slug,
    message: notification.message,
    urgency: notification.urgency,
    type: notification.type,
  });

  if (insertError) {
    return false;
  }

  return true;
}

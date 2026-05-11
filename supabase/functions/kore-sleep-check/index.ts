import { createClient } from "npm:@supabase/supabase-js@2";

import { sendKoreNotification } from "../_shared/notify.ts";

const MIN_HOURS_PEQUE = 10;
const PERSON_PEQUE = "Peque";

/**
 * Devuelve el inicio del día actual en zona horaria Europe/Madrid
 * como ISO 8601 con offset (equivalente a:
 *   date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
 * en Postgres) y la fecha YYYY-MM-DD usada para los slugs.
 */
function getStartOfTodayMadrid(): { startIso: string; dateMadrid: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";

  const match = tzName.match(/([+-])(\d{1,2}):?(\d{2})?/);
  const sign = match?.[1] ?? "+";
  const hh = (match?.[2] ?? "00").padStart(2, "0");
  const mm = (match?.[3] ?? "00").padStart(2, "0");

  const dateMadrid = `${year}-${month}-${day}`;
  const startIso = `${dateMadrid}T00:00:00${sign}${hh}:${mm}`;
  return { startIso, dateMadrid };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        ok: false,
        error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { startIso, dateMadrid } = getStartOfTodayMadrid();

    const { data, error } = await supabase
      .from("sleep_logs")
      .select("hours, logged_at")
      .eq("person", PERSON_PEQUE)
      .eq("type", "sleep_hours")
      .gte("logged_at", startIso);

    if (error) {
      return jsonResponse(500, {
        ok: false,
        stage: "query",
        error: error.message,
      });
    }

    const rows = data ?? [];

    let notification: {
      message: string;
      urgency: "alta" | "media" | "baja";
      type: string;
      slug: string;
    };

    let hoursSum = 0;

    if (rows.length === 0) {
      notification = {
        message: "No hay registro de sueño de Peque hoy",
        urgency: "media",
        type: "sleep_check",
        slug: `sleep-olvido-${dateMadrid}`,
      };
    } else {
      hoursSum = rows.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
      const hoursDisplay = Number.isInteger(hoursSum)
        ? String(hoursSum)
        : hoursSum.toFixed(1);

      if (hoursSum < MIN_HOURS_PEQUE) {
        notification = {
          message: `Peque ha dormido poco: ${hoursDisplay}h`,
          urgency: "alta",
          type: "sleep_check",
          slug: `sleep-anomalia-${dateMadrid}`,
        };
      } else {
        notification = {
          message: "Sueño de Peque correcto hoy",
          urgency: "baja",
          type: "sleep_check",
          slug: `sleep-ok-${dateMadrid}`,
        };
      }
    }

    const sent = await sendKoreNotification(notification);

    return jsonResponse(200, {
      ok: true,
      date: dateMadrid,
      windowStart: startIso,
      records: rows.length,
      hoursSum,
      slug: notification.slug,
      urgency: notification.urgency,
      sent,
    });
  } catch (e) {
    return jsonResponse(500, {
      ok: false,
      stage: "unhandled",
      error: (e as Error).message,
    });
  }
});

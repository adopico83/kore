import { createClient } from "npm:@supabase/supabase-js@2";

import { sendKoreNotification } from "../_shared/notify.ts";

const MIN_HOURS_PEQUE = 10;
const PERSON_PEQUE = "Peque";

/** Misma familia que en `src/lib/kore-db.ts` (filtro de agenda). */
const FAMILY_ID = "8378283a-cfc0-46ec-90c0-07e45c885aee";

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

/** Suma un día civil a `YYYY-MM-DD` (calendario gregoriano, coherente con la fecha ya en Madrid). */
function addOneDayYmd(ymd: string): string {
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatAgendaTime(time: string | null): string {
  if (time == null || time.trim() === "") return "--:--";
  const t = time.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return t;
}

type CalendarEventRow = {
  title: string;
  time: string | null;
};

/**
 * Texto de vistazo de agenda para mañana (Madrid), o cadena vacía si no hay eventos o falla la consulta.
 */
async function buildTomorrowAgendaBlock(
  supabase: ReturnType<typeof createClient>,
  dateTomorrowMadrid: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("title, time")
    .eq("family_id", FAMILY_ID)
    .eq("date", dateTomorrowMadrid)
    .order("time", { ascending: true, nullsFirst: false });

  if (error) {
    return "";
  }

  const events = (data ?? []) as CalendarEventRow[];
  if (events.length === 0) {
    return "";
  }

  const lines = events.map(
    (ev) => `• ${formatAgendaTime(ev.time)} - ${ev.title}`,
  );
  return `📅 MAÑANA EN TU AGENDA:\n${lines.join("\n")}`;
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
    const dateTomorrowMadrid = addOneDayYmd(dateMadrid);

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

    let sleepMessage: string;
    let notification: {
      message: string;
      urgency: "alta" | "media" | "baja";
      type: string;
      slug: string;
    };

    let hoursSum = 0;

    if (rows.length === 0) {
      sleepMessage = "No hay registro de sueño de Peque hoy";
      notification = {
        message: sleepMessage,
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
        sleepMessage = `Peque ha dormido poco: ${hoursDisplay}h`;
        notification = {
          message: sleepMessage,
          urgency: "alta",
          type: "sleep_check",
          slug: `sleep-anomalia-${dateMadrid}`,
        };
      } else {
        sleepMessage = "Sueño de Peque correcto hoy";
        notification = {
          message: sleepMessage,
          urgency: "baja",
          type: "sleep_check",
          slug: `sleep-ok-${dateMadrid}`,
        };
      }
    }

    const agendaBlock = await buildTomorrowAgendaBlock(supabase, dateTomorrowMadrid);
    if (agendaBlock) {
      notification.message = `${sleepMessage}\n\n${agendaBlock}`;
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

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { sendKoreNotification } from "./lib/notify";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  const sent = await sendKoreNotification({
    message: "Jarvis online. Sistema activo.",
    urgency: "alta",
    type: "system_test",
    slug: `test-${Date.now()}`,
  });
  console.log(sent ? "sendKoreNotification: enviado (true)" : "sendKoreNotification: no enviado (false)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export const dynamic = "force-dynamic";

import { HomeClient } from "./HomeClient";
import { LEIRE_ID } from "@/lib/kore-db";
import { createClient } from "@/lib/supabase/server";

type CorchoPreviewMessage = {
  who: "Ander" | "Leire";
  avatar: "A" | "L";
  ownerColor: string;
  text: string;
  when: string;
};

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.from("kore_notes").select("*").order("created_at", { ascending: false }).limit(3);

  const initialCorchoMessages: CorchoPreviewMessage[] = (data ?? []).map((row) => {
    const who = row.sender_id === LEIRE_ID ? "Leire" : "Ander";
    return {
      who,
      avatar: who === "Leire" ? "L" : "A",
      ownerColor: who === "Leire" ? "#f59e0b" : "#10b981",
      text: row.content ?? "(nota sin texto)",
      when: new Date(row.created_at).toLocaleString("es-ES"),
    };
  });

  return <HomeClient initialCorchoMessages={initialCorchoMessages} />;
}

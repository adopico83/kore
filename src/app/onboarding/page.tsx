"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

type ChatMessage = { id: string; role: "assistant" | "user"; content: string };
type OnboardingMode = "none" | "newborn" | "guided";

type GuidedAnswers = {
  familyPeople: string;
  selectedDomains: string[];
  routineInfo: string;
};

const DOMAIN_DEFAULTS: Record<string, { agent: string; weight: number }> = {
  Compras: { agent: "logistica", weight: 8 },
  "Menú": { agent: "logistica", weight: 7 },
  Limpieza: { agent: "armonia", weight: 6 },
  Agenda: { agent: "logistica", weight: 9 },
  Colegio: { agent: "logistica", weight: 7 },
  "Economía": { agent: "logistica", weight: 6 },
  "Sueño": { agent: "armonia", weight: 8 },
  Ocio: { agent: "armonia", weight: 5 },
  Mantenimiento: { agent: "logistica", weight: 4 },
  Salud: { agent: "armonia", weight: 7 },
};

const INITIAL_MESSAGE = "Hola, soy Kore. He preparado vuestro espacio.\n¿Cómo empezamos?";

const GUIDED_DOMAIN_OPTIONS = [
  "Compras",
  "Menú",
  "Limpieza",
  "Agenda",
  "Colegio",
  "Economía",
  "Sueño",
  "Ocio",
  "Mantenimiento",
  "Salud",
] as const;

async function getSessionContext() {
  const supabase = getBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error(userError?.message || "No hay sesión activa.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.family_id) {
    throw new Error(profileError?.message || "No se pudo resolver la familia actual.");
  }

  return { supabase, userId: user.id, familyId: profile.family_id };
}

async function completeOnboarding(familyId: string) {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("families").update({ onboarding_step: "completed" }).eq("id", familyId);
  if (error) throw new Error(error.message || "No se pudo completar el onboarding.");
}

async function ensureActiveDomains(familyId: string, names: string[]) {
  const supabase = getBrowserClient();
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length === 0) return;

  const { data: existingRows, error: selectError } = await supabase
    .from("domains")
    .select("id,name")
    .eq("family_id", familyId)
    .in("name", uniqueNames);
  if (selectError) throw new Error(selectError.message || "No se pudieron consultar dominios.");

  const existingNames = new Set((existingRows ?? []).map((row) => row.name));
  const missingNames = uniqueNames.filter((name) => !existingNames.has(name));

  if (missingNames.length > 0) {
    const { error: insertError } = await supabase.from("domains").insert(
      missingNames.map((name) => ({
        family_id: familyId,
        name,
        agent: DOMAIN_DEFAULTS[name]?.agent ?? "logistica",
        weight: DOMAIN_DEFAULTS[name]?.weight ?? 5,
        is_active: true,
      })),
    );
    if (insertError) throw new Error(insertError.message || "No se pudieron crear dominios faltantes.");
  }

  const { error: updateError } = await supabase
    .from("domains")
    .update({ is_active: true })
    .eq("family_id", familyId)
    .in("name", uniqueNames);
  if (updateError) throw new Error(updateError.message || "No se pudieron activar dominios.");
}

async function saveMemory(familyId: string, key: string, value: string, category = "onboarding") {
  const supabase = getBrowserClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("agent_memory").insert({
    family_id: familyId,
    key: `${key}_${Date.now()}`,
    value,
    category,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message || "No se pudo guardar memoria.");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<OnboardingMode>("none");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "init", role: "assistant", content: INITIAL_MESSAGE },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({
    familyPeople: "",
    selectedDomains: [],
    routineInfo: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const showModeButtons = mode === "none";
  const showGuidedChecklist = mode === "guided" && guidedStep === 2;

  const guidedPrompt = useMemo(() => {
    if (mode !== "guided") return "";
    if (guidedStep === 1) {
      return "Pregunta 1/4: ¿Cómo os llamáis y cómo se llaman vuestros hijos? Pueden ser uno o varios, o ninguno de momento.";
    }
    if (guidedStep === 2) {
      return "Pregunta 2/4: ¿Qué dominios queréis activar ahora?";
    }
    if (guidedStep === 3) {
      return "Pregunta 3/4: ¿A qué hora soléis cenar y cuáles son las rutinas de sueño en casa?";
    }
    return "";
  }, [guidedStep, mode]);

  const appendUser = (content: string) =>
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);

  const appendAssistant = (content: string) =>
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content }]);

  const startNewborn = () => {
    setMode("newborn");
    appendAssistant(
      "Perfecto. ¿Cómo os llamáis y cómo se llaman vuestros hijos?\nPueden ser uno o varios, o ninguno de momento",
    );
  };

  const startGuided = () => {
    setMode("guided");
    setGuidedStep(1);
    appendAssistant(
      "Perfecto, vamos paso a paso.\nPregunta 1/4: ¿Cómo os llamáis y cómo se llaman vuestros hijos? Pueden ser uno o varios, o ninguno de momento.",
    );
  };

  const handleNewbornSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = inputValue.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setError("");
    appendUser(text);
    setInputValue("");

    try {
      const { familyId } = await getSessionContext();
      const orcInstruction = [
        "Contexto onboarding recién nacido:",
        text,
        "Activa los dominios Sueño, Salud, Compras y Menú.",
        "Guarda memoria relevante en agent_memory para el arranque de la familia.",
      ].join("\n");

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: orcInstruction, historial: [] }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; respuesta?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo contactar con ORC.");

      await ensureActiveDomains(familyId, ["Sueño", "Salud", "Compras", "Menú"]);
      await saveMemory(familyId, "newborn_context", text, "onboarding");
      await completeOnboarding(familyId);

      appendAssistant(
        (typeof data.reply === "string" && data.reply) ||
          (typeof data.respuesta === "string" && data.respuesta) ||
          "Listo. Ya está preparado el modo recién nacido.",
      );
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuidedSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    try {
      if (guidedStep === 1) {
        const text = inputValue.trim();
        if (!text) return;
        appendUser(text);
        setInputValue("");
        setGuidedAnswers((prev) => ({ ...prev, familyPeople: text }));
        setGuidedStep(2);
        appendAssistant("Pregunta 2/4: Seleccionad los dominios que queréis activar ahora.");
        return;
      }

      if (guidedStep === 2) {
        if (guidedAnswers.selectedDomains.length === 0) {
          setError("Selecciona al menos un dominio para continuar.");
          return;
        }
        setError("");
        appendUser(`Dominios elegidos: ${guidedAnswers.selectedDomains.join(", ")}`);
        setGuidedStep(3);
        appendAssistant("Pregunta 3/4: ¿A qué hora soléis cenar y cuáles son las rutinas de sueño en casa?");
        return;
      }

      if (guidedStep !== 3) return;

      const routineText = inputValue.trim();
      if (!routineText) return;
      setSubmitting(true);
      setError("");
      appendUser(routineText);
      setInputValue("");

      const { supabase, familyId } = await getSessionContext();
      const names = guidedAnswers.familyPeople
        .split(/[,\n]/)
        .map((token) => token.trim())
        .filter(Boolean);

      if (names.length > 0) {
        const profileRows = names.map((name) => ({
          id: crypto.randomUUID(),
          name,
          family_id: familyId,
          role: "member",
        }));
        console.log("[onboarding] INSERT profiles pareja/hijos payload", {
          familyId,
          count: profileRows.length,
          rows: profileRows,
        });
        const { error: profileInsertError } = await supabase.from("profiles").insert(profileRows);
        console.log("[onboarding] INSERT profiles pareja/hijos result", {
          familyId,
          error: profileInsertError?.message ?? null,
        });
        if (profileInsertError) throw new Error(profileInsertError.message || "No se pudieron crear perfiles.");
      }

      await ensureActiveDomains(familyId, guidedAnswers.selectedDomains);
      await saveMemory(familyId, "guided_people", guidedAnswers.familyPeople, "onboarding");
      await saveMemory(familyId, "guided_routines", routineText, "onboarding");
      await completeOnboarding(familyId);

      setGuidedAnswers((prev) => ({ ...prev, routineInfo: routineText }));
      setGuidedStep(4);
      appendAssistant("Pregunta 4/4: Perfecto, ya está configurado. Vamos a vuestra home.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el flujo guiado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#090b10",
        color: "#e4e6ed",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          background: "rgba(22,26,34,0.92)",
          padding: 16,
          boxShadow: "0 16px 36px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "52dvh", overflowY: "auto" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.role === "assistant" ? "flex-start" : "flex-end",
                maxWidth: "92%",
                borderRadius: msg.role === "assistant" ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
                background: msg.role === "assistant" ? "#161a22" : "#4CC9A0",
                color: msg.role === "assistant" ? "#e4e6ed" : "#090b10",
                border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.14)" : "none",
                padding: "10px 12px",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {msg.content}
            </div>
          ))}
          {guidedPrompt && mode === "guided" && guidedStep <= 3 ? (
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "92%",
                borderRadius: "12px 12px 12px 4px",
                background: "#161a22",
                border: "1px solid rgba(255,255,255,0.14)",
                padding: "10px 12px",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {guidedPrompt}
            </div>
          ) : null}
        </div>

        {showModeButtons ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={startNewborn}
              style={{
                border: "none",
                borderRadius: 12,
                minHeight: 54,
                background: "#4CC9A0",
                color: "#0a1a14",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🍼 Modo Recién Nacido
            </button>
            <button
              type="button"
              onClick={startGuided}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                minHeight: 54,
                background: "rgba(255,255,255,0.06)",
                color: "#e4e6ed",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚙️ Configurar poco a poco
            </button>
          </div>
        ) : null}

        {mode === "newborn" ? (
          <form onSubmit={handleNewbornSubmit} style={{ display: "grid", gap: 8 }}>
            <label htmlFor="newborn-input" style={{ fontSize: 13, color: "rgba(228,230,237,0.8)" }}>
              ¿Cómo os llamáis y cómo se llaman vuestros hijos? Pueden ser uno o varios, o ninguno de momento
            </label>
            <input
              id="newborn-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe aquí..."
              disabled={submitting}
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "#121622",
                color: "#e4e6ed",
                padding: "10px 12px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={submitting || !inputValue.trim()}
              style={{
                minHeight: 44,
                border: "none",
                borderRadius: 10,
                background: "#4CC9A0",
                color: "#0a1a14",
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Configurando..." : "Continuar"}
            </button>
          </form>
        ) : null}

        {mode === "guided" ? (
          <form onSubmit={handleGuidedSubmit} style={{ display: "grid", gap: 8 }}>
            {showGuidedChecklist ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 8,
                }}
              >
                {GUIDED_DOMAIN_OPTIONS.map((name) => {
                  const selected = guidedAnswers.selectedDomains.includes(name);
                  return (
                    <label
                      key={name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 8,
                        border: selected ? "1px solid #4CC9A0" : "1px solid rgba(255,255,255,0.15)",
                        background: selected ? "rgba(76,201,160,0.1)" : "rgba(255,255,255,0.04)",
                        padding: "8px 10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) =>
                          setGuidedAnswers((prev) => ({
                            ...prev,
                            selectedDomains: e.target.checked
                              ? [...prev.selectedDomains, name]
                              : prev.selectedDomains.filter((domain) => domain !== name),
                          }))
                        }
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Escribe aquí..."
                disabled={submitting}
                style={{
                  minHeight: 44,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "#121622",
                  color: "#e4e6ed",
                  padding: "10px 12px",
                  outline: "none",
                }}
              />
            )}
            <button
              type="submit"
              disabled={submitting || (guidedStep !== 2 && !inputValue.trim())}
              style={{
                minHeight: 44,
                border: "none",
                borderRadius: 10,
                background: "#9B8FE8",
                color: "#11131a",
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Guardando..." : guidedStep === 3 ? "Finalizar" : "Continuar"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p style={{ margin: 0, color: "#fca5a5", fontSize: 13 }}>
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

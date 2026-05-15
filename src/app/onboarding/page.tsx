"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { parseFamilyPeopleForOnboarding } from "@/lib/actions/extract-family-members";
import { BASE_DOMAINS, type DomainName } from "@/lib/domains-catalog";
import { OnboardingFamilyGate } from "./OnboardingFamilyGate";

type ChatMessage = { id: string; role: "assistant" | "user"; content: string };
type OnboardingMode = "none" | "newborn" | "guided";

type GuidedAnswers = {
  familyPeople: string;
  selectedDomains: DomainName[];
  routineInfo: string;
};

const INITIAL_MESSAGE = "Hola, soy Kore. He preparado vuestro espacio.\n¿Cómo empezamos?";

const GUIDED_DOMAIN_OPTIONS = BASE_DOMAINS.map((domain) => domain.name) as DomainName[];
const NEWBORN_CRITICAL_DOMAIN_OPTIONS = BASE_DOMAINS.filter((domain) => domain.isCritical).map(
  (domain) => domain.name,
) as DomainName[];

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

  return { familyId: profile.family_id };
}

async function resolveDomainIdsByNames(familyId: string, names: string[]): Promise<string[]> {
  const supabase = getBrowserClient();
  const uniqueNames = Array.from(new Set(names));
  if (uniqueNames.length === 0) return [];

  const { data: existingRows, error: selectError } = await supabase
    .from("domains")
    .select("id,name")
    .eq("family_id", familyId)
    .in("name", uniqueNames);
  if (selectError) throw new Error(selectError.message || "No se pudieron consultar dominios.");

  const idsByName = new Map((existingRows ?? []).map((row) => [row.name, row.id]));
  const missingNames = uniqueNames.filter((name) => !idsByName.has(name));
  if (missingNames.length > 0) {
    throw new Error(`Faltan dominios base: ${missingNames.join(", ")}.`);
  }
  return uniqueNames.map((name) => idsByName.get(name)!).filter(Boolean);
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

async function parseFamilyPeople(input: string): Promise<{ partnerName: string; childrenNames: string[] }> {
  return parseFamilyPeopleForOnboarding(input);
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
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
          <p style={{ margin: 0, color: "rgba(228,230,237,0.75)" }}>Cargando…</p>
        </main>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const lastProcessedStep = useRef(0);
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

  const [familyAccess, setFamilyAccess] = useState<"loading" | "none" | "ok">("loading");

  useEffect(() => {
    void (async () => {
      const supabase = getBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFamilyAccess("none");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle();
      setFamilyAccess(profile?.family_id ? "ok" : "none");
    })();
  }, []);

  useEffect(() => {
    if (mode === "none") {
      lastProcessedStep.current = 0;
    }
  }, [mode]);

  const showModeButtons = mode === "none";
  const showGuidedChecklist = mode === "guided" && guidedStep === 2;

  const appendUser = (content: string) =>
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content }]);

  const appendAssistant = (content: string) =>
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content }]);

  const startNewborn = () => {
    lastProcessedStep.current = 0;
    setMode("newborn");
    appendAssistant(
      "Perfecto. ¿Cómo os llamáis y cómo se llaman vuestros hijos?\nPueden ser uno o varios, o ninguno de momento",
    );
  };

  const startGuided = () => {
    if (lastProcessedStep.current === 1) return;
    lastProcessedStep.current = 1;
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
        `Activa los dominios ${NEWBORN_CRITICAL_DOMAIN_OPTIONS.join(", ")}.`,
        "Guarda memoria relevante en agent_memory para el arranque de la familia.",
      ].join("\n");

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: orcInstruction, historial: [] }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; respuesta?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo contactar con Kore.");

      const selectedDomainIds = await resolveDomainIdsByNames(familyId, NEWBORN_CRITICAL_DOMAIN_OPTIONS);
      const { partnerName, childrenNames } = await parseFamilyPeople(text);
      const result = await completeOnboardingAction({
        familyId,
        partnerName,
        childrenNames,
        selectedDomainIds,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      await saveMemory(familyId, "newborn_context", text, "onboarding");

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
        if (lastProcessedStep.current >= 2) return;
        const text = inputValue.trim();
        if (!text) return;
        appendUser(text);
        setInputValue("");
        setGuidedAnswers((prev) => ({ ...prev, familyPeople: text }));
        setGuidedStep(2);
        lastProcessedStep.current = 2;
        appendAssistant("Pregunta 2/4: Seleccionad los dominios que queréis activar ahora.");
        return;
      }

      if (guidedStep === 2) {
        if (lastProcessedStep.current >= 3) return;
        if (guidedAnswers.selectedDomains.length === 0) {
          setError("Selecciona al menos un dominio para continuar.");
          return;
        }
        setError("");
        appendUser(`Dominios elegidos: ${guidedAnswers.selectedDomains.join(", ")}`);
        setGuidedStep(3);
        lastProcessedStep.current = 3;
        appendAssistant("Pregunta 3/4: ¿A qué hora soléis cenar y cuáles son las rutinas de sueño en casa?");
        return;
      }

      if (guidedStep !== 3) return;

      if (lastProcessedStep.current >= 4) return;

      const routineText = inputValue.trim();
      if (!routineText) return;
      setSubmitting(true);
      setError("");
      appendUser(routineText);
      setInputValue("");

      const { familyId } = await getSessionContext();
      const selectedDomainIds = await resolveDomainIdsByNames(familyId, guidedAnswers.selectedDomains);
      const { partnerName, childrenNames } = await parseFamilyPeople(guidedAnswers.familyPeople);

      const result = await completeOnboardingAction({
        familyId,
        partnerName,
        childrenNames,
        selectedDomainIds,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      await saveMemory(familyId, "guided_people", guidedAnswers.familyPeople, "onboarding");
      await saveMemory(familyId, "guided_routines", routineText, "onboarding");

      setGuidedAnswers((prev) => ({ ...prev, routineInfo: routineText }));
      setGuidedStep(4);
      lastProcessedStep.current = 4;
      appendAssistant("Pregunta 4/4: Perfecto, ya está configurado. Vamos a vuestra home.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el flujo guiado.");
    } finally {
      setSubmitting(false);
    }
  };

  if (familyAccess === "loading") {
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
        <p style={{ margin: 0, color: "rgba(228,230,237,0.75)" }}>Cargando…</p>
      </main>
    );
  }

  if (familyAccess === "none") {
    return (
      <main
        style={{
          minHeight: "100dvh",
          background: "#090b10",
          color: "#e4e6ed",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <Suspense
          fallback={
            <p style={{ margin: 0, color: "rgba(228,230,237,0.75)" }}>Cargando…</p>
          }
        >
          <OnboardingFamilyGate />
        </Suspense>
        <Link
          href="/login"
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "rgba(228,230,237,0.55)",
            cursor: "pointer",
            textAlign: "center",
            textDecoration: "underline",
            textDecorationColor: "rgba(228,230,237,0.28)",
            textUnderlineOffset: "4px",
          }}
        >
          Ya tengo cuenta · Iniciar sesión
        </Link>
      </main>
    );
  }

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

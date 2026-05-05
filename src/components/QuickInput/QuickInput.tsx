"use client";

import { Loader2, Mic } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { getBrowserClient } from "@/lib/supabase/client";

type QuickInputState =
  | "idle"
  | "recording"
  | "transcribing"
  | "ready"
  | "saving"
  | "saved"
  | "error";

const PLACEHOLDER_USER = "ander-placeholder";

const MEDICATION_KEYWORDS = [
  "paracetamol",
  "ibuprofeno",
  "aspirina",
  "omeprazol",
  "amoxicilina",
  "loratadina",
  "diazepam",
  "metformina",
  "atorvastatina",
  "levotiroxina",
  "salbutamol",
  "naproxeno",
  "diclofenaco",
  "bisoprolol",
  "losartan",
  "enalapril",
  "warfarina",
  "sintrom",
  "insulina",
  "ventolin",
  "antibiótico",
  "antibiotico",
  "jarabe",
  "inhalador",
  "pastilla",
  "medicación",
  "medicacion",
  "medicamento",
  "receta",
  "miligramos",
  "mg ",
  " ml ",
];

function inferEventType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("€") || /\beuros?\b/.test(t)) {
    return "gasto";
  }
  for (const word of MEDICATION_KEYWORDS) {
    if (t.includes(word)) {
      return "medicacion";
    }
  }
  return "nota";
}

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

function statusLabel(
  state: QuickInputState,
  errorMessage: string | null,
): string {
  switch (state) {
    case "idle":
      return "Pulsa el micrófono para grabar";
    case "recording":
      return "Grabando… pulsa de nuevo para terminar";
    case "transcribing":
      return "Transcribiendo con Whisper…";
    case "ready":
      return "Revisa o edita el texto y pulsa Registrar";
    case "saving":
      return "Guardando en el registro…";
    case "saved":
      return "Evento guardado";
    case "error":
      return errorMessage ?? "Ha ocurrido un error";
    default:
      return "";
  }
}

export function QuickInput() {
  const [state, setState] = useState<QuickInputState>("idle");
  const [text, setText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const sendChunksForTranscription = useCallback(async (blob: Blob) => {
    setState("transcribing");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("audio", blob, blob.type.includes("mp4") ? "recording.mp4" : "recording.webm");

    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as { text?: string; texto?: string; error?: string };
    const transcribed = (data.texto ?? data.text ?? "").trim();

    if (!res.ok || !transcribed) {
      setErrorMessage(data.error ?? "No se pudo transcribir");
      setState("error");
      return;
    }

    setText(transcribed);
    setState("ready");
  }, []);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") {
      return;
    }
    rec.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stopStreamTracks();
        mediaRecorderRef.current = null;

        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];

        if (blob.size === 0) {
          setErrorMessage("No se capturó audio");
          setState("error");
          return;
        }

        void sendChunksForTranscription(blob);
      };

      recorder.start();
      setState("recording");
    } catch {
      setErrorMessage("No se pudo acceder al micrófono");
      setState("error");
    }
  }, [sendChunksForTranscription, stopStreamTracks]);

  const toggleMic = useCallback(() => {
    if (state === "recording") {
      stopRecording();
      return;
    }
    if (state === "idle" || state === "ready" || state === "saved" || state === "error") {
      void startRecording();
    }
  }, [state, startRecording, stopRecording]);

  const handleRegister = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setState("saving");
    setErrorMessage(null);

    const supabase = getBrowserClient();
    const type = inferEventType(trimmed);

    const { error } = await supabase.from("events_log").insert({
      user_id: PLACEHOLDER_USER,
      type,
      raw_input: trimmed,
      domain_id: null,
    });

    if (error) {
      setErrorMessage(error.message);
      setState("error");
      return;
    }

    setState("saved");
    setText("");
    window.setTimeout(() => {
      setState("idle");
    }, 2000);
  }, [text]);

  const showRegister =
    text.trim().length > 0 &&
    state !== "recording" &&
    state !== "transcribing";

  return (
    <div
      className="flex min-h-[100dvh] w-full max-w-lg flex-col items-center gap-6 px-4 py-8"
      style={{ backgroundColor: "#090b10", color: "#e8eaef" }}
    >
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          aria-label={state === "recording" ? "Detener grabación" : "Iniciar grabación"}
          disabled={state === "transcribing" || state === "saving"}
          onClick={toggleMic}
          className="flex shrink-0 items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-60"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            padding: 0,
            overflow: "hidden",
            backgroundColor:
              state === "recording"
                ? "#E05555"
                : state === "transcribing"
                  ? "#2d3f38"
                  : "#4CC9A0",
          }}
        >
          {state === "transcribing" ? (
            <Loader2 className="size-9 animate-spin text-white" aria-hidden />
          ) : (
            <Mic className="size-9 text-white" strokeWidth={2} aria-hidden />
          )}
        </button>
        <p className="max-w-[280px] text-center text-sm leading-snug text-[#a8b0c0]">
          {statusLabel(state, errorMessage)}
        </p>
      </div>

      <label className="sr-only" htmlFor="quick-input-text">
        Texto transcrito
      </label>
      <textarea
        id="quick-input-text"
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (state === "saved") setState("idle");
          if (state === "error" && errorMessage) {
            setState("ready");
            setErrorMessage(null);
          }
        }}
        placeholder="El dictado aparecerá aquí…"
        className="w-full resize-y rounded-xl border border-[#1e2433] bg-[#121622] px-4 py-3 text-base text-[#e8eaef] placeholder:text-[#5c6578] focus:border-[#4CC9A0] focus:outline-none focus:ring-1 focus:ring-[#4CC9A0]"
      />

      {showRegister ? (
        <button
          type="button"
          onClick={() => void handleRegister()}
          disabled={state === "saving"}
          className="w-full rounded-xl bg-[#4CC9A0] px-4 py-3 text-base font-medium text-[#090b10] transition-opacity disabled:opacity-50"
        >
          {state === "saving" ? "Registrando…" : "Registrar"}
        </button>
      ) : null}
    </div>
  );
}

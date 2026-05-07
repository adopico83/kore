"use client";

import { History, Loader2, Paperclip, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import { emitKoreUpdate } from "@/lib/kore-events";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { addKoreNote, ANDER_ID, getKoreNotes, LEIRE_ID } from "@/lib/kore-db";

const GREEN = "#4CC9A0";
const PURPLE = "#9B8FE8";
const TEXT = "#e4e6ed";
const BG = "#090b10";
const CARD = "#161a22";

const CORCHO_CONV_ID = "kore_corcho_global";

type CorchoRole = "ander" | "leire";

type CorchoMessage = {
  id: string;
  role: CorchoRole;
  content: string;
  imagenPreviews?: string[];
  at: string;
};

type CorchoConv = {
  id: string;
  firstPhrase: string;
  createdAt: string;
  total: number;
};

function formatHHMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function compressImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("img"));
    el.src = dataUrl;
  });
  const max = 1600;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w <= 0 || h <= 0) throw new Error("dims");
  if (w > max || h > max) {
    if (w >= h) {
      h = Math.round((h * max) / w);
      w = max;
    } else {
      w = Math.round((w * max) / h);
      h = max;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ctx");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function ConvRow({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: CorchoConv;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li style={{ listStyle: "none", display: "flex", gap: 6 }}>
      <button
        type="button"
        onClick={onSelect}
        style={{
          flex: 1,
          minWidth: 0,
          borderRadius: 10,
          border: active ? `1px solid ${PURPLE}` : "1px solid rgba(255,255,255,0.12)",
          background: active ? "rgba(155,143,232,0.15)" : "rgba(255,255,255,0.04)",
          color: TEXT,
          textAlign: "left",
          cursor: "pointer",
          padding: "9px 10px",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {conv.firstPhrase || "Nueva conversación"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{conv.total} mensajes</p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Eliminar conversación"
        style={{
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "transparent",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          padding: 7,
        }}
      >
        <Trash2 width={14} height={14} />
      </button>
    </li>
  );
}

export type CorchoChatProps = {
  onClose: () => void;
};

export function CorchoChat({ onClose }: CorchoChatProps) {
  useEscapeKey(onClose);
  const [mensaje, setMensaje] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [conversaciones, setConversaciones] = useState<CorchoConv[]>([]);
  const [historial, setHistorial] = useState<CorchoMessage[]>([]);
  const [panelHistorial, setPanelHistorial] = useState(false);
  const [error, setError] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [imagenesPendientes, setImagenesPendientes] = useState<string[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderMimeTypeRef = useRef<string>("audio/webm");
  const micGestureHandledRef = useRef(false);

  const loadMessages = async () => {
    const rows = await getKoreNotes();
    const latest = rows.slice(0, 50);
    const mapped: CorchoMessage[] = [...latest].reverse().map((row) => ({
      id: row.id,
      role: row.sender_id === LEIRE_ID ? "leire" : "ander",
      content: String(row.content ?? "").trim(),
      at: row.created_at ?? "",
    }));
    setHistorial(mapped);
    const first = mapped[0]?.content?.trim() ?? "";
    const firstPhrase = first.length > 60 ? `${first.slice(0, 60)}…` : first || "Nueva conversación";
    setConversaciones([
      {
        id: CORCHO_CONV_ID,
        firstPhrase,
        createdAt: mapped[0]?.at ?? new Date().toISOString(),
        total: mapped.length,
      },
    ]);
    setConversationId(CORCHO_CONV_ID);
  };

  useEffect(() => {
    void loadMessages();
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [historial, panelHistorial, transcribiendo]);

  const touchEnd = (fn: () => void, disabled?: boolean) => ({
    onTouchEnd: (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      fn();
    },
  });

  const nuevaConversacion = () => {
    setConversationId(CORCHO_CONV_ID);
    setMensaje("");
    setError("");
    setPanelHistorial(false);
    setImagenesPendientes([]);
  };

  const seleccionarConversacion = (id: string) => {
    setConversationId(id);
    setPanelHistorial(false);
  };

  const eliminarConversacion = (_id: string) => {
    // Mantiene el diseño del historial de conversaciones sin borrar notas de Supabase.
    setPanelHistorial(false);
  };

  const handleImagen = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError("");
    const incoming: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Solo imágenes.");
        return;
      }
      try {
        incoming.push(await compressImage(file));
      } catch {
        setError("No se pudo procesar una imagen.");
        return;
      }
    }
    setImagenesPendientes((prev) => [...prev, ...incoming].slice(0, 12));
  };

  const handleEnviarTexto = async (texto: string, fromTranscription?: boolean) => {
    const clean = texto.trim();
    const imagenes = imagenesPendientes;
    if (!clean && imagenes.length === 0) {
      if (fromTranscription) setTranscribiendo(false);
      setError("Escribe un mensaje o adjunta una imagen.");
      return;
    }
    const msg: CorchoMessage = {
      id: crypto.randomUUID?.() ?? `m_${Date.now()}`,
      role: "ander",
      content: clean || (imagenes.length > 1 ? `📎 ${imagenes.length} imágenes` : "📎 Imagen"),
      imagenPreviews: imagenes.length ? imagenes.slice() : undefined,
      at: new Date().toISOString(),
    };
    const persistedText = msg.content;
    await addKoreNote({
      content: persistedText,
      sender_id: ANDER_ID,
      recipient_id: LEIRE_ID,
      audio_url: null,
      status: "unread",
      priority: "low",
    });
    await loadMessages();
    emitKoreUpdate(["kore_notes"]);
    setMensaje("");
    setImagenesPendientes([]);
    setError("");
    if (fromTranscription) setTranscribiendo(false);
  };

  const handleEnviar = () => {
    void handleEnviarTexto(mensaje);
  };

  const attachRecorderToStream = (stream: MediaStream) => {
    const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mp4a", "audio/aac"];
    const chosen = preferred.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    mediaRecorderMimeTypeRef.current = chosen || "audio/webm";
    const recorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: mediaRecorderMimeTypeRef.current || "audio/webm" });
      audioChunksRef.current = [];
      setGrabando(false);
      setTranscribiendo(true);
      void transcribeAndSend(blob);
    };
    recorder.start();
  };

  const requestMicAndStartRecording = () => {
    if (grabando || transcribiendo) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Tu navegador no soporta grabación de audio.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("getUserMedia no está disponible");
      return;
    }
    setError("");
    audioChunksRef.current = [];
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaStreamRef.current = stream;
        setGrabando(true);
        attachRecorderToStream(stream);
      })
      .catch((err: unknown) => {
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        setGrabando(false);
        setError(name === "NotAllowedError" ? "Permiso de micrófono denegado" : "Error al solicitar micrófono");
      });
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      if (recorder.state !== "inactive") recorder.stop();
      else setGrabando(false);
    } finally {
      const stream = mediaStreamRef.current;
      stream?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (grabando) stopRecording();
    else requestMicAndStartRecording();
  };

  const handleMicPointerDown = (disabled: boolean) => (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    micGestureHandledRef.current = true;
    toggleRecording();
  };

  const handleMicClick = (disabled: boolean) => (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (micGestureHandledRef.current) {
      e.preventDefault();
      micGestureHandledRef.current = false;
      return;
    }
    toggleRecording();
  };

  const transcribeAndSend = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { texto?: string; text?: string; error?: string };
      if (!res.ok) {
        setTranscribiendo(false);
        setError(data.error?.trim() || "Error al transcribir");
        return;
      }
      const texto = (data.texto ?? data.text ?? "").trim();
      if (!texto) {
        setTranscribiendo(false);
        setError("No se obtuvo texto del audio");
        return;
      }
      setMensaje(texto);
      await handleEnviarTexto(texto, true);
    } catch {
      setTranscribiendo(false);
      setError("Error al transcribir el audio");
    }
  };

  const btnGhost: CSSProperties = {
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 500,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 8000, display: "flex", flexDirection: "column", background: BG }}
      role="dialog"
      aria-modal="true"
      aria-label="Mensajes con Leire"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        aria-hidden
        onChange={(e) => void handleImagen(e)}
      />
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <div style={{ display: "flex", minWidth: 0, flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Mensajes con Leire</span>
          <button type="button" onClick={nuevaConversacion} {...touchEnd(nuevaConversacion)} style={btnGhost}>
            Nuevo
          </button>
          <button
            type="button"
            onClick={() => setPanelHistorial((v) => !v)}
            style={{ ...btnGhost, display: "inline-flex", alignItems: "center", gap: 4 }}
            aria-label="Historial de conversaciones"
          >
            <History width={14} height={14} />
            Historial
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          {...touchEnd(onClose)}
          aria-label="Cerrar"
          style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", padding: 8, background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
        >
          <X width={20} height={20} />
        </button>
      </header>

      <div ref={listRef} style={{ minHeight: 0, flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {panelHistorial ? (
          <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {conversaciones.length === 0 ? (
              <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>No hay conversaciones guardadas.</p>
            ) : (
              conversaciones.map((conv) => (
                <ConvRow
                  key={conv.id}
                  conv={conv}
                  active={conv.id === conversationId}
                  onSelect={() => seleccionarConversacion(conv.id)}
                  onDelete={() => eliminarConversacion(conv.id)}
                />
              ))
            )}
          </ul>
        ) : historial.length === 0 && !transcribiendo ? (
          <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", padding: 12, color: "rgba(255,255,255,0.75)" }}>
            Escribe a Leire.
          </div>
        ) : (
          <>
            {historial.map((msg) => {
              const isAnder = msg.role === "ander";
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isAnder ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "90%" }}>
                    <div
                      style={{
                        borderRadius: isAnder ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        padding: "8px 12px",
                        background: isAnder ? GREEN : "#1c2028",
                        color: isAnder ? "#0a1a14" : TEXT,
                        border: isAnder ? "none" : `1px solid ${PURPLE}55`,
                      }}
                    >
                      {(msg.imagenPreviews ?? []).length > 0 ? (
                        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: isAnder ? "flex-end" : "flex-start" }}>
                          {(msg.imagenPreviews ?? []).map((src, idx) => (
                            <img key={`${msg.id}-${idx}`} src={src} alt="" style={{ maxHeight: 112, maxWidth: "45%", borderRadius: 6, border: "1px solid rgba(0,0,0,0.2)", objectFit: "cover" }} />
                          ))}
                        </div>
                      ) : null}
                      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14 }}>{msg.content}</p>
                    </div>
                    <p style={{ margin: "4px 0 0", textAlign: isAnder ? "right" : "left", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                      {formatHHMM(msg.at)}
                    </p>
                  </div>
                </div>
              );
            })}
            {transcribiendo ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 10, border: `1px solid ${PURPLE}66`, background: CARD, padding: "8px 12px", color: TEXT }}>
                  <Loader2 width={16} height={16} style={{ animation: "kore-spin 0.8s linear infinite" }} />
                  Transcribiendo audio...
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        {error ? (
          <div style={{ borderRadius: 8, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(239,68,68,0.15)", padding: "8px 12px", fontSize: 12, color: "#fecaca" }}>
            {error}
          </div>
        ) : null}
        {imagenesPendientes.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", padding: 8 }}>
            {imagenesPendientes.map((src, idx) => (
              <div key={`img-${idx}-${src.slice(0, 20)}`} style={{ position: "relative" }}>
                <img src={src} alt="" style={{ width: 64, height: 64, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => setImagenesPendientes((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Quitar imagen"
                  style={{ position: "absolute", top: -4, right: -4, borderRadius: 999, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: 4, lineHeight: 0, cursor: "pointer" }}
                >
                  <X width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleEnviar();
            }
          }}
          rows={3}
          placeholder="Escribe un mensaje..."
          style={{ width: "100%", resize: "none", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", padding: "8px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", minHeight: 44, alignItems: "stretch", gap: 8 }}>
          <button
            type="button"
            aria-label="Adjuntar imagen"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", width: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer" }}
          >
            <Paperclip width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            {...touchEnd(handleEnviar, transcribiendo || grabando || (mensaje.trim().length === 0 && imagenesPendientes.length === 0))}
            disabled={transcribiendo || grabando || (mensaje.trim().length === 0 && imagenesPendientes.length === 0)}
            style={{ flex: 1, minWidth: 0, borderRadius: 8, border: "none", background: GREEN, color: "#0a1a14", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Enviar
          </button>
          <button
            type="button"
            aria-label={grabando ? "Detener grabación" : "Grabar audio"}
            onPointerDown={handleMicPointerDown(transcribiendo)}
            onClick={handleMicClick(transcribiendo)}
            style={{
              display: "flex",
              width: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: grabando ? "1px solid rgba(248,113,113,0.65)" : "1px solid rgba(255,255,255,0.1)",
              background: grabando ? "#dc2626" : "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            🎤
          </button>
        </div>
      </footer>
    </div>
  );
}

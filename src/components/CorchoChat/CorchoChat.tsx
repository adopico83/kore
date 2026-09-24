"use client";

import { History, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import type { ChangeEvent, CSSProperties } from "react";
import {
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import { corchoMessageText } from "@/components/home/home-model";
import { CorchoPhotoGrid, CorchoPhotoLightbox } from "@/components/CorchoChat/CorchoPhotos";
import { onKoreRemoteChanges } from "@/lib/kore-events";
import { mergeCorchoMessage, readKoreNote } from "@/lib/optimistic-state";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { CORCHO_MAX_PHOTOS } from "@/lib/corcho-photos";
import { compressImageToJpegBlob } from "@/lib/compress-image";
import { addCorchoNote, deleteCorchoNote, getKoreNotes, type CorchoNote } from "@/lib/actions/corcho";

const GREEN = "#4CC9A0";
const PURPLE = "#9B8FE8";
const TEXT = "#e4e6ed";
const BG = "#090b10";
const CARD = "#161a22";

const CORCHO_CONV_ID = "kore_corcho_global";

type CorchoRole = "me" | "partner";

type CorchoMessage = {
  id: string;
  role: CorchoRole;
  content: string;
  at: string;
  imageUrls: string[];
  pending?: boolean;
};

type CorchoListAction = { type: "upsert"; message: CorchoMessage } | { type: "remove"; id: string };

function applyCorchoAction(messages: CorchoMessage[], action: CorchoListAction): CorchoMessage[] {
  if (action.type === "remove") return messages.filter((message) => message.id !== action.id);
  if (messages.some((message) => message.id === action.message.id)) {
    return messages.map((message) => (message.id === action.message.id ? action.message : message));
  }
  return [...messages, action.message];
}

type FotoPendiente = {
  id: string;
  url: string;
  blob: Blob;
};

const fileInputHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
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
  /** Sesión: remitente de los mensajes que envía esta vista. */
  currentUserId: string;
  /** Perfil destinatario (otro adulto); obligatorio en BD para `recipient_id`. */
  partnerUserId: string;
  recipientName?: string;
  /** Dentro de la pestaña, sin cubrir el chrome de la home. */
  embedded?: boolean;
  onNoteSaved?: (note: CorchoNote) => void;
  onNoteDeleted?: (id: string) => void;
};

export function CorchoChat({
  onClose,
  currentUserId,
  partnerUserId,
  recipientName = "tu pareja",
  embedded = false,
  onNoteSaved,
  onNoteDeleted,
}: CorchoChatProps) {
  const [mensaje, setMensaje] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [conversaciones, setConversaciones] = useState<CorchoConv[]>([]);
  const [historial, setHistorial] = useState<CorchoMessage[]>([]);
  const [optimisticHistorial, applyCorcho] = useOptimistic(historial, applyCorchoAction);
  const [panelHistorial, setPanelHistorial] = useState(false);
  const [error, setError] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [fotosPendientes, setFotosPendientes] = useState<FotoPendiente[]>([]);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderMimeTypeRef = useRef<string>("audio/webm");
  const micGestureHandledRef = useRef(false);

  const canSendCorcho = Boolean(currentUserId.trim() && partnerUserId.trim());

  const closeTop = useCallback(() => {
    if (fotoAbierta) {
      setFotoAbierta(null);
      return;
    }
    onClose();
  }, [fotoAbierta, onClose]);
  useEscapeKey(closeTop);

  const loadMessages = useCallback(async () => {
    let rows: Awaited<ReturnType<typeof getKoreNotes>>;
    try {
      rows = await getKoreNotes();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudieron cargar los recados.");
      return;
    }
    const latest = rows.slice(0, 50);
    const mapped: CorchoMessage[] = [...latest].reverse().map((row) => ({
      id: row.id,
      role: row.sender_id === currentUserId ? "me" : "partner",
      content: corchoMessageText(row.content, row.imageUrls.length),
      at: row.created_at ?? "",
      imageUrls: row.imageUrls,
    }));
    setHistorial(mapped);
    const firstRaw = mapped[0]?.content?.trim() ?? "";
    const first = firstRaw || (mapped[0] && mapped[0].imageUrls.length > 0 ? "Foto" : "");
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
  }, [currentUserId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    return onKoreRemoteChanges((changes) => {
      for (const change of changes) {
        if (change.table !== "kore_notes") continue;
        if (change.event === "DELETE" && change.id) {
          const id = change.id;
          setHistorial((prev) => prev.filter((message) => message.id !== id));
          continue;
        }
        const note = readKoreNote(change.row);
        if (!note) continue;
        const message: CorchoMessage = {
          id: note.id,
          role: note.sender_id === currentUserId ? "me" : "partner",
          content: corchoMessageText(note.content, 0),
          at: note.created_at ?? "",
          imageUrls: [],
        };
        setHistorial((prev) => mergeCorchoMessage(prev, message));
      }
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [optimisticHistorial, panelHistorial, transcribiendo]);

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
  };

  const seleccionarConversacion = (id: string) => {
    setConversationId(id);
    setPanelHistorial(false);
  };

  const eliminarConversacion = (_id: string) => {
    // Mantiene el diseño del historial de conversaciones sin borrar notas de Supabase.
    setPanelHistorial(false);
  };

  const soltarFotos = (fotos: FotoPendiente[]) => {
    for (const foto of fotos) URL.revokeObjectURL(foto.url);
  };

  const quitarFoto = (id: string) => {
    setFotosPendientes((prev) => {
      const found = prev.find((foto) => foto.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((foto) => foto.id !== id);
    });
  };

  const handleEnviarTexto = async (texto: string, fromTranscription?: boolean) => {
    const clean = texto.trim();
    const fotos = fotosPendientes;
    if (!clean && fotos.length === 0) {
      if (fromTranscription) setTranscribiendo(false);
      setError("Escribe un recado o adjunta una foto.");
      return;
    }
    const uid = currentUserId.trim();
    const pid = partnerUserId.trim();
    if (!uid || !pid) {
      setError(
        !uid
          ? "No hay sesión de usuario para enviar el mensaje."
          : "No hay otro adulto en el hogar como destinatario. Completa el onboarding o añade a tu pareja.",
      );
      if (fromTranscription) setTranscribiendo(false);
      return;
    }

    setEnviando(true);
    setError("");
    setMensaje("");
    setFotosPendientes([]);
    const tempId = crypto.randomUUID();
    startTransition(async () => {
      applyCorcho({
        type: "upsert",
        message: {
          id: tempId,
          role: "me",
          content: corchoMessageText(clean, fotos.length),
          at: new Date().toISOString(),
          imageUrls: fotos.map((foto) => foto.url),
          pending: true,
        },
      });
      try {
        const formData = new FormData();
        formData.set("id", tempId);
        formData.set("content", clean);
        formData.set("recipient_id", pid);
        fotos.forEach((foto, index) => {
          formData.append("photos", new File([foto.blob], `foto-${index + 1}.jpg`, { type: "image/jpeg" }));
        });
        const note = await addCorchoNote(formData);
        const saved: CorchoMessage = {
          id: note.id,
          role: "me",
          content: corchoMessageText(note.content, note.imageUrls.length),
          at: note.created_at ?? new Date().toISOString(),
          imageUrls: note.imageUrls,
        };
        setHistorial((prev) => mergeCorchoMessage(prev, saved));
        onNoteSaved?.(note);
        queueMicrotask(() => soltarFotos(fotos));
      } catch (error) {
        setError(error instanceof Error ? error.message : "No se pudo enviar el recado. Se ha deshecho.");
        setMensaje(clean);
        setFotosPendientes(fotos);
      } finally {
        setEnviando(false);
        if (fromTranscription) setTranscribiendo(false);
      }
    });
  };

  const handleEnviar = () => {
    if (enviando || transcribiendo || grabando) return;
    void handleEnviarTexto(mensaje);
  };

  const handleFotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    const nuevas: FotoPendiente[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Solo se pueden adjuntar fotos.");
        soltarFotos(nuevas);
        return;
      }
      try {
        const blob = await compressImageToJpegBlob(file);
        nuevas.push({ id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob });
      } catch {
        setError("No se pudo procesar una foto.");
        soltarFotos(nuevas);
        return;
      }
    }
    const room = CORCHO_MAX_PHOTOS - fotosPendientes.length;
    const accepted = nuevas.slice(0, Math.max(room, 0));
    soltarFotos(nuevas.slice(accepted.length));
    if (accepted.length < nuevas.length) {
      setError(`Puedes adjuntar hasta ${CORCHO_MAX_PHOTOS} fotos.`);
    }
    if (accepted.length > 0) {
      setFotosPendientes((prev) => [...prev, ...accepted].slice(0, CORCHO_MAX_PHOTOS));
    }
  };

  const eliminarRecado = (id: string) => {
    if (!window.confirm("¿Eliminar este recado? También se borrarán sus fotos.")) return;
    startTransition(async () => {
      applyCorcho({ type: "remove", id });
      try {
        await deleteCorchoNote(id);
        setHistorial((prev) => prev.filter((message) => message.id !== id));
        onNoteDeleted?.(id);
        setError("");
      } catch (error) {
        setError(error instanceof Error ? error.message : "No se pudo eliminar el recado. Se ha deshecho.");
      }
    });
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
    if (grabando || transcribiendo || !canSendCorcho) return;
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
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { texto?: string; text?: string; error?: string };
      if (res.status === 401) {
        setTranscribiendo(false);
        setError("Tu sesión ha caducado. Vuelve a entrar para usar la voz.");
        return;
      }
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
      style={
        embedded
          ? { position: "relative", flex: 1, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", background: BG }
          : { position: "fixed", inset: 0, zIndex: 8000, display: "flex", flexDirection: "column", background: BG }
      }
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label={`Mensajes con ${recipientName}`}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
        <div style={{ display: "flex", minWidth: 0, flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{`Mensajes con ${recipientName}`}</span>
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
          onClick={closeTop}
          {...touchEnd(closeTop)}
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
        ) : optimisticHistorial.length === 0 && !transcribiendo ? (
          <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", padding: 12, color: "rgba(255,255,255,0.75)" }}>
            {`Escribe a ${recipientName}...`}
          </div>
        ) : (
          <>
            {optimisticHistorial.map((msg) => {
              const isMe = msg.role === "me";
              return (
                <div key={msg.id} aria-busy={msg.pending ? true : undefined} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", opacity: msg.pending ? 0.55 : 1 }}>
                  <div style={{ maxWidth: "90%" }}>
                    <div
                      style={{
                        borderRadius: isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        padding: "8px 12px",
                        background: isMe ? GREEN : "#1c2028",
                        color: isMe ? "#0a1a14" : TEXT,
                        border: isMe ? "none" : `1px solid ${PURPLE}55`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <CorchoPhotoGrid urls={msg.imageUrls} onOpen={setFotoAbierta} />
                      {msg.content ? (
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14 }}>{msg.content}</p>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center", gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                        {msg.pending ? "Enviando…" : formatHHMM(msg.at)}
                      </p>
                      <button
                        type="button"
                        onClick={() => eliminarRecado(msg.id)}
                        aria-label="Eliminar recado"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.45)",
                          cursor: "pointer",
                          padding: 0,
                          lineHeight: 0,
                        }}
                      >
                        <Trash2 width={12} height={12} />
                      </button>
                    </div>
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
        {fotosPendientes.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {fotosPendientes.map((foto) => (
              <div key={foto.id} style={{ position: "relative", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.url}
                  alt=""
                  style={{ width: 64, height: 64, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", objectFit: "cover" }}
                />
                <button
                  type="button"
                  onClick={() => quitarFoto(foto.id)}
                  aria-label="Quitar foto"
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.7)",
                    padding: 4,
                    color: "#fff",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <X width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void handleFotos(event)}
          tabIndex={-1}
          style={fileInputHidden}
        />
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
          placeholder={`Escribe a ${recipientName}...`}
          style={{ width: "100%", resize: "none", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", padding: "8px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", minHeight: 44, alignItems: "stretch", gap: 8 }}>
          <button
            type="button"
            aria-label="Adjuntar foto"
            disabled={transcribiendo || grabando || enviando || !canSendCorcho}
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex",
              width: 44,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              cursor: transcribiendo || grabando || enviando || !canSendCorcho ? "not-allowed" : "pointer",
              opacity: transcribiendo || grabando || enviando || !canSendCorcho ? 0.5 : 1,
            }}
          >
            <ImagePlus width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            {...touchEnd(handleEnviar, transcribiendo || grabando || enviando || !canSendCorcho || (mensaje.trim().length === 0 && fotosPendientes.length === 0))}
            disabled={transcribiendo || grabando || enviando || !canSendCorcho || (mensaje.trim().length === 0 && fotosPendientes.length === 0)}
            style={{ flex: 1, minWidth: 0, borderRadius: 8, border: "none", background: GREEN, color: "#0a1a14", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
          <button
            type="button"
            aria-label={grabando ? "Detener grabación" : "Grabar audio"}
            onPointerDown={handleMicPointerDown(transcribiendo || enviando || !canSendCorcho)}
            onClick={handleMicClick(transcribiendo || enviando || !canSendCorcho)}
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
      {fotoAbierta ? <CorchoPhotoLightbox url={fotoAbierta} onClose={() => setFotoAbierta(null)} /> : null}
    </div>
  );
}

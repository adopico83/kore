"use client";

import { History, Loader2, Paperclip, Trash2, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import { emitKoreUpdate, type KoreTable } from "@/lib/kore-events";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

const LS_INDEX = "kore_orc_conv_index";
const lsMsgsKey = (id: string) => `kore_orc_msgs_${id}`;
const LS_ACTIVE = "kore_orc_active_conv";

const toolToTable: Record<string, KoreTable[]> = {
  // Agenda
  add_calendar_event: ["calendar_events"],
  get_calendar_events: [],
  delete_calendar_event: ["calendar_events"],
  get_upcoming_events: [],

  // Colegio
  add_school_event: ["school_events", "calendar_events"],
  get_school_events: [],
  add_school_material: ["school_materials"],
  get_school_materials: [],
  delete_school_item: ["school_events", "school_materials"],

  // Compras
  add_shopping_item: ["shopping_items"],
  get_shopping_list: [],
  complete_shopping_item: ["shopping_items"],
  delete_shopping_item: ["shopping_items"],
  clear_completed_items: ["shopping_items"],

  // Limpieza
  add_cleaning_task: ["cleaning_tasks"],
  get_cleaning_tasks: [],
  complete_cleaning_task: ["cleaning_tasks"],
  get_pending_cleaning: [],

  // Menú
  add_menu_item: ["menu_items"],
  get_weekly_menu: [],
  clear_day_menu: ["menu_items"],
  suggest_menu: [],

  // Sueño
  log_wakeup: ["sleep_logs"],
  log_sleep_hours: ["sleep_logs"],
  get_sleep_summary: [],
  get_night_recovery_score: [],

  // Tiempo libre
  add_leisure_activity: ["leisure_activities"],
  get_leisure_activities: [],
  log_personal_time: ["leisure_activities"],
  get_balance_summary: [],

  // Salud
  add_appointment: ["health_records", "calendar_events"],
  add_medication: ["health_records"],
  log_medication_given: ["health_records"],
  get_health_records: [],
  complete_appointment: ["health_records"],
  delete_health_record: ["health_records"],

  // Corcho
  send_note: ["kore_notes"],
  get_unread_notes: [],
  mark_note_read: ["kore_notes"],
  get_notes_history: [],

  // Economía
  add_expense: ["expenses"],
  get_monthly_summary: [],
  get_expenses_list: [],
  get_balance: [],
  delete_expense: ["expenses"],

  // Memoria
  save_pattern: ["agent_memory"],
  get_patterns: [],
  save_insight: ["agent_memory"],
  get_relevant_memories: [],
};

type MessageRole = "user" | "assistant";

type ConvMeta = {
  conversation_id: string;
  titulo: string;
  created_at: string;
  total_mensajes: number;
};

type ToolExecuted = { name: string; success: boolean; result: unknown; error?: string };

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imagenPreviews?: string[];
  at: string;
  /** Acciones de tools aplicadas en la respuesta del ORC (servidor). */
  toolsExecuted?: ToolExecuted[];
}

function formatHHMM(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatFechaRelativa(input: string, anchorMs: number | null) {
  if (anchorMs == null) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "Fecha desconocida";
  const now = new Date(anchorMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return `Hace ${diff} días`;
  return d.toLocaleDateString("es-ES", { dateStyle: "short" });
}

function generateConversationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `conv_${Date.now()}`;
}

function readConvIndex(): ConvMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_INDEX);
    if (!raw) return [];
    const p = JSON.parse(raw) as ConvMeta[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeConvIndex(list: ConvMeta[]) {
  try {
    localStorage.setItem(LS_INDEX, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

function readMsgs(cid: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(lsMsgsKey(cid));
    if (!raw) return [];
    const p = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeMsgs(cid: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(lsMsgsKey(cid), JSON.stringify(msgs));
  } catch {
    /* ignore */
  }
}

async function comprimirImagenParaAgente(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("img"));
    el.src = dataUrl;
  });
  const maxSide = 1600;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w <= 0 || h <= 0) throw new Error("dims");
  if (w > maxSide || h > maxSide) {
    if (w >= h) {
      h = Math.round((h * maxSide) / w);
      w = maxSide;
    } else {
      w = Math.round((w * maxSide) / h);
      h = maxSide;
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

const GREEN = "#4CC9A0";
const PURPLE = "#9B8FE8";
const TEXT = "#e4e6ed";

const srOnly: CSSProperties = {
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

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p style={{ margin: 0, color: TEXT }}>{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong style={{ fontWeight: 700, color: GREEN }}>{children}</strong>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul
      style={{
        margin: 0,
        paddingLeft: 24,
        listStyleType: "disc",
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol
      style={{
        margin: 0,
        paddingLeft: 24,
        listStyleType: "decimal",
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li style={{ color: TEXT }}>{children}</li>,
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 style={{ margin: "8px 0 4px", fontSize: 16, fontWeight: 700, color: "#fff" }}>{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 style={{ margin: "8px 0 4px", fontSize: 14, fontWeight: 700, color: "#fff" }}>{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 style={{ margin: "6px 0 4px", fontSize: 14, fontWeight: 700, color: "#fff" }}>{children}</h3>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: PURPLE, textDecoration: "underline", textUnderlineOffset: 2 }}
    >
      {children}
    </a>
  ),
};

function TypingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }} aria-live="polite">
      <div
        style={{
          maxWidth: "90%",
          borderRadius: "12px 12px 12px 4px",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "12px 16px",
          color: "#fff",
          background: "#161a22",
        }}
        role="status"
      >
        <span style={srOnly}>El ORC está escribiendo</span>
        <div style={{ display: "flex", height: 16, alignItems: "center", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: "50%",
                background: "#fff",
                animation: "kore-typing-dot 1.1s ease-in-out infinite",
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TranscribingIndicator() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }} aria-live="polite">
      <div
        style={{
          display: "flex",
          maxWidth: "90%",
          alignItems: "center",
          gap: 10,
          borderRadius: "12px 12px 12px 4px",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "12px 16px",
          color: "#fff",
          background: "#161a22",
        }}
        role="status"
      >
        <span style={srOnly}>Transcribiendo audio</span>
        <span style={{ display: "inline-flex", animation: "kore-spin 0.85s linear infinite" }}>
          <Loader2 width={18} height={18} color={GREEN} aria-hidden />
        </span>
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.95)" }}>Transcribiendo audio</span>
      </div>
    </div>
  );
}

function ConvRow({
  conv,
  isActive,
  isConfirming,
  fechaRelativaAnchorMs,
  onSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  conv: ConvMeta;
  isActive: boolean;
  isConfirming: boolean;
  fechaRelativaAnchorMs: number | null;
  onSelect: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  if (isConfirming) {
    return (
      <li style={{ listStyle: "none" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderRadius: 8,
            border: `1px solid ${GREEN}99`,
            padding: "8px 10px",
            background: "#161a22",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.35, color: "rgba(255,255,255,0.95)" }}>
            ¿Eliminar esta conversación?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onConfirmDelete}
              style={{
                flex: 1,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                color: "#090b10",
                background: GREEN,
                border: "none",
                cursor: "pointer",
              }}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              style={{
                flex: 1,
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 500,
                color: "#fff",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.25)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li style={{ listStyle: "none" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
        <button
          type="button"
          onClick={onSelect}
          style={{
            minWidth: 0,
            flex: 1,
            borderRadius: 8,
            border: isActive ? "1px solid rgba(76,201,160,0.7)" : "1px solid rgba(255,255,255,0.1)",
            background: isActive ? "rgba(76,201,160,0.12)" : "rgba(255,255,255,0.05)",
            padding: "8px 10px",
            textAlign: "left",
            cursor: "pointer",
            color: "inherit",
            font: "inherit",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: 4,
            }}
          >
            {conv.titulo}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            {formatFechaRelativa(conv.created_at, fechaRelativaAnchorMs)} · {conv.total_mensajes} mensajes
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRequestDelete();
          }}
          style={{
            marginTop: 4,
            flexShrink: 0,
            alignSelf: "flex-start",
            borderRadius: 6,
            border: "1px solid transparent",
            padding: 6,
            color: "rgba(255,255,255,0.45)",
            background: "transparent",
            cursor: "pointer",
          }}
          aria-label="Eliminar conversación"
        >
          <Trash2 width={14} height={14} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export type AgentChatProps = {
  onClose: () => void;
};

export function AgentChat({ onClose }: AgentChatProps) {
  useEscapeKey(onClose);
  const [fechaRelativaAnchorMs, setFechaRelativaAnchorMs] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [historial, setHistorial] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [conversaciones, setConversaciones] = useState<ConvMeta[]>([]);
  const [panelHistorial, setPanelHistorial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendoAudio, setTranscribiendoAudio] = useState(false);
  const [error, setError] = useState("");
  const [imagenesPendientes, setImagenesPendientes] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderMimeTypeRef = useRef<string>("audio/webm");
  const micGestureHandledRef = useRef(false);

  useEffect(() => {
    setFechaRelativaAnchorMs(Date.now());
  }, []);

  const persistMessages = useCallback((cid: string, msgs: ChatMessage[]) => {
    writeMsgs(cid, msgs);
  }, []);

  const persistIndex = useCallback((list: ConvMeta[]) => {
    writeConvIndex(list);
    setConversaciones(list);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const idx = readConvIndex();
    setConversaciones(idx);
    const savedActive = localStorage.getItem(LS_ACTIVE)?.trim();
    const pick =
      (savedActive && idx.some((c) => c.conversation_id === savedActive) ? savedActive : null) ??
      idx[0]?.conversation_id ??
      generateConversationId();
    setConversationId(pick);
    setHistorial(readMsgs(pick));
    if (!idx.length) {
      const first: ConvMeta = {
        conversation_id: pick,
        titulo: "Nueva conversación",
        created_at: new Date().toISOString(),
        total_mensajes: readMsgs(pick).length,
      };
      persistIndex([first]);
    } else {
      try {
        localStorage.setItem(LS_ACTIVE, pick);
      } catch {
        /* ignore */
      }
    }
    setHydrated(true);
  }, [persistIndex]);

  useEffect(() => {
    if (!hydrated || !conversationId) return;
    try {
      localStorage.setItem(LS_ACTIVE, conversationId);
    } catch {
      /* ignore */
    }
    persistMessages(conversationId, historial);

    const idx = readConvIndex();
    const rawTitulo = historial.find((m) => m.role === "user")?.content.trim() ?? "";
    const titulo =
      rawTitulo.length > 60 ? `${rawTitulo.slice(0, 60)}…` : rawTitulo || "Nueva conversación";
    const exists = idx.some((c) => c.conversation_id === conversationId);
    const next: ConvMeta[] = exists
      ? idx.map((c) =>
          c.conversation_id === conversationId
            ? {
                ...c,
                total_mensajes: historial.length,
                titulo: historial.some((m) => m.role === "user") ? titulo : c.titulo,
              }
            : c,
        )
      : [
          {
            conversation_id: conversationId,
            titulo,
            created_at: new Date().toISOString(),
            total_mensajes: historial.length,
          },
          ...idx,
        ].slice(0, 20);
    writeConvIndex(next);
    setConversaciones(next);
  }, [historial, conversationId, hydrated, persistMessages]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [historial, loading, transcribiendoAudio, panelHistorial]);

  const touchEnd = (fn: () => void, disabled?: boolean) => ({
    onTouchEnd: (e: TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      fn();
    },
  });

  const handleEnviarTexto = async (texto: string, opts?: { desdeTranscripcion?: boolean }) => {
    const textoTrim = texto.trim();
    const imagenesEnviar = imagenesPendientes;
    if (!textoTrim && imagenesEnviar.length === 0) {
      if (opts?.desdeTranscripcion) setTranscribiendoAudio(false);
      setError("Escribe un mensaje o adjunta una imagen.");
      return;
    }
    setError("");
    setMensaje("");
    setImagenesPendientes([]);
    const now = new Date().toISOString();
    const contenidoUsuario =
      textoTrim ||
      (imagenesEnviar.length > 1
        ? `📎 ${imagenesEnviar.length} imágenes adjuntas`
        : "📎 Imagen adjunta");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() ?? `u_${Date.now()}`,
      role: "user",
      content: contenidoUsuario,
      imagenPreviews: imagenesEnviar.length ? imagenesEnviar.slice() : undefined,
      at: now,
    };
    setHistorial((prev) => [...prev, userMsg]);
    if (opts?.desdeTranscripcion) setTranscribiendoAudio(false);

    const histParaApi = [...historial, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: textoTrim,
          historial: histParaApi.slice(0, -1),
          ...(imagenesEnviar.length > 0 ? { imagenes: imagenesEnviar } : {}),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        respuesta?: string;
        toolsExecuted?: ToolExecuted[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Error al llamar al ORC");
        return;
      }
      const respuestaTexto =
        typeof data.reply === "string" && data.reply.length > 0
          ? data.reply
          : typeof data.respuesta === "string"
            ? data.respuesta
            : "";
      const toolsExecuted = Array.isArray(data.toolsExecuted) ? data.toolsExecuted : undefined;
      if (toolsExecuted?.length) {
        const touched = new Set<KoreTable>();
        for (const tool of toolsExecuted) {
          if (!tool.success) continue;
          for (const table of toolToTable[tool.name] ?? []) touched.add(table);
        }
        if (touched.size > 0) emitKoreUpdate(Array.from(touched));
      }
      const asstAt = new Date().toISOString();
      setHistorial((prev) => [
        ...prev,
        {
          id: crypto.randomUUID?.() ?? `a_${Date.now()}`,
          role: "assistant",
          content: respuestaTexto,
          at: asstAt,
          ...(toolsExecuted?.length ? { toolsExecuted } : {}),
        },
      ]);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = () => {
    void handleEnviarTexto(mensaje);
  };

  const attachRecorderToStream = (stream: MediaStream) => {
    const preferredMimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/mp4a",
      "audio/aac",
    ];
    const chosenMimeType = preferredMimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    mediaRecorderMimeTypeRef.current = chosenMimeType || "audio/webm";
    const recorder = new MediaRecorder(
      stream,
      chosenMimeType ? { mimeType: chosenMimeType } : undefined,
    );
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const mimeType = mediaRecorderMimeTypeRef.current || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];
      setGrabando(false);
      setTranscribiendoAudio(true);
      void transcribeAndSend(audioBlob);
    };
    recorder.start();
  };

  const requestMicAndStartRecording = () => {
    if (grabando || loading) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Tu navegador no soporta grabación de audio.");
      return;
    }
    setError("");
    audioChunksRef.current = [];
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("getUserMedia no está disponible");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        try {
          mediaStreamRef.current = stream;
          setGrabando(true);
          attachRecorderToStream(stream);
        } catch (e: unknown) {
          stream.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          setGrabando(false);
          setError(e instanceof Error ? e.message : "Error al iniciar la grabación");
        }
      })
      .catch((err: unknown) => {
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setGrabando(false);
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        if (name === "NotAllowedError") {
          setError("Permiso de micrófono denegado");
          return;
        }
        setError(err instanceof Error ? err.message : "Error al solicitar el micrófono");
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
    if (disabled) return;
    if (e.button !== 0) return;
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
        setTranscribiendoAudio(false);
        setError(data.error?.trim() || "Error al transcribir");
        return;
      }
      const textoTranscrito = (data.texto ?? data.text ?? "").trim();
      if (!textoTranscrito) {
        setTranscribiendoAudio(false);
        setError("No se obtuvo texto del audio");
        return;
      }
      setMensaje(textoTranscrito);
      await handleEnviarTexto(textoTranscrito, { desdeTranscripcion: true });
    } catch {
      setTranscribiendoAudio(false);
      setError("Error al transcribir el audio");
    }
  };

  const nuevaConversacion = () => {
    const next = generateConversationId();
    setHistorial([]);
    setConversationId(next);
    setError("");
    setTranscribiendoAudio(false);
    setImagenesPendientes([]);
    setPanelHistorial(false);
    const meta: ConvMeta = {
      conversation_id: next,
      titulo: "Nueva conversación",
      created_at: new Date().toISOString(),
      total_mensajes: 0,
    };
    const prev = readConvIndex();
    persistIndex([meta, ...prev.filter((c) => c.conversation_id !== next)].slice(0, 20));
    writeMsgs(next, []);
    try {
      localStorage.setItem(LS_ACTIVE, next);
    } catch {
      /* ignore */
    }
  };

  const seleccionarConversacion = (cid: string) => {
    if (!cid || cid === conversationId) {
      setPanelHistorial(false);
      return;
    }
    setConversationId(cid);
    setPanelHistorial(false);
    setHistorial(readMsgs(cid));
    try {
      localStorage.setItem(LS_ACTIVE, cid);
    } catch {
      /* ignore */
    }
  };

  const confirmarEliminarConversacion = (cid: string) => {
    const nextList = readConvIndex().filter((c) => c.conversation_id !== cid);
    persistIndex(nextList);
    try {
      localStorage.removeItem(lsMsgsKey(cid));
    } catch {
      /* ignore */
    }
    setConfirmDeleteId(null);
    if (conversationId === cid) {
      if (nextList.length > 0) {
        const first = nextList[0];
        seleccionarConversacion(first.conversation_id);
      } else {
        nuevaConversacion();
      }
    }
  };

  const handleImagen = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError("");
    const nuevas: string[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Solo imágenes.");
        return;
      }
      try {
        nuevas.push(await comprimirImagenParaAgente(file));
      } catch {
        setError("No se pudo procesar una imagen.");
        return;
      }
    }
    setImagenesPendientes((prev) => [...prev, ...nuevas].slice(0, 12));
  };

  const mostrarTyping =
    loading && historial.length > 0 && historial[historial.length - 1]?.role === "user";

  const puedeEnviar = mensaje.trim().length > 0 || imagenesPendientes.length > 0;

  const btnGhost: CSSProperties = {
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.1)",
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 500,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  const micBtnStyle: CSSProperties = grabando
    ? {
        display: "flex",
        width: 44,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px solid rgba(248,113,113,0.6)",
        background: "#dc2626",
        color: "#fff",
        padding: "10px 0",
        cursor: "pointer",
        boxShadow: "0 0 0 3px rgba(248,113,113,0.2)",
      }
    : {
        display: "flex",
        width: 44,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.1)",
        color: "#fff",
        padding: "10px 0",
        cursor: "pointer",
      };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8000,
        display: "flex",
        flexDirection: "column",
        background: "#090b10",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="ORC — Orquestador Kore"
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

      <header
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 12px",
        }}
      >
        <div style={{ display: "flex", minWidth: 0, flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            ORC — Orquestador Kore
          </span>
          <button type="button" onClick={nuevaConversacion} {...touchEnd(nuevaConversacion)} style={btnGhost}>
            Nuevo
          </button>
          <button
            type="button"
            onClick={() => setPanelHistorial((v) => !v)}
            style={{
              ...btnGhost,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            aria-label="Historial de conversaciones"
          >
            <History width={14} height={14} aria-hidden />
            Historial
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          {...touchEnd(onClose)}
          style={{
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: 8,
            color: "rgba(255,255,255,0.85)",
            background: "transparent",
            cursor: "pointer",
          }}
          aria-label="Cerrar"
        >
          <X width={20} height={20} />
        </button>
      </header>

      <div
        ref={listRef}
        style={{
          minHeight: 0,
          flex: 1,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {panelHistorial ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                Conversaciones
              </p>
              <button
                type="button"
                onClick={() => setPanelHistorial(false)}
                style={{ ...btnGhost, padding: "4px 8px" }}
              >
                Cerrar
              </button>
            </div>
            {conversaciones.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                No hay conversaciones guardadas.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {conversaciones.map((conv) => (
                  <ConvRow
                    key={conv.conversation_id}
                    conv={conv}
                    isActive={conv.conversation_id === conversationId}
                    isConfirming={confirmDeleteId === conv.conversation_id}
                    fechaRelativaAnchorMs={fechaRelativaAnchorMs}
                    onSelect={() => seleccionarConversacion(conv.conversation_id)}
                    onRequestDelete={() => setConfirmDeleteId(conv.conversation_id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={() => confirmarEliminarConversacion(conv.conversation_id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : historial.length === 0 && !transcribiendoAudio ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 12,
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Escribe un mensaje al ORC para coordinar agenda, gastos, salud y dominios del hogar.
          </div>
        ) : (
          <>
            {historial.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "90%" }}>
                    <div
                      style={{
                        borderRadius: "12px 12px 4px 12px",
                        padding: "8px 12px",
                        background: GREEN,
                        color: "#090b10",
                      }}
                    >
                      {(msg.imagenPreviews ?? []).length > 0 ? (
                        <div
                          style={{
                            marginBottom: 8,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          {(msg.imagenPreviews ?? []).map((src, idx) => (
                            <img
                              key={`${msg.id}-img-${idx}`}
                              src={src}
                              alt=""
                              style={{
                                maxHeight: 112,
                                maxWidth: "45%",
                                borderRadius: 6,
                                border: "1px solid rgba(0,0,0,0.2)",
                                objectFit: "cover",
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14 }}>{msg.content}</p>
                    </div>
                    <p style={{ margin: "4px 0 0", textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                      {formatHHMM(msg.at)}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ maxWidth: "min(90%, 100%)" }}>
                    <div
                      style={{
                        borderRadius: "12px 12px 12px 4px",
                        border: "1px solid rgba(155,143,232,0.25)",
                        padding: "8px 12px",
                        background: "#161a22",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: TEXT,
                        }}
                      >
                        <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {(msg.toolsExecuted ?? []).length > 0 ? (
                      <div style={{ marginTop: 6 }}>
                        {(msg.toolsExecuted ?? []).map((t, idx) => (
                          <p
                            key={`${msg.id}-tool-${idx}-${t.name}`}
                            style={{
                              margin: 0,
                              fontSize: 11,
                              color: "#4CC9A0",
                              fontStyle: "italic",
                            }}
                          >
                            {t.success ? "✓" : "✕"} {t.name}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                      {formatHHMM(msg.at)}
                    </p>
                  </div>
                </div>
              ),
            )}
            {transcribiendoAudio ? <TranscribingIndicator /> : null}
            {mostrarTyping ? <TypingIndicator /> : null}
          </>
        )}
      </div>

      <footer
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: 12,
        }}
      >
        {error ? (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(239,68,68,0.15)",
              padding: "8px 12px",
              fontSize: 12,
              color: "#fecaca",
            }}
          >
            {error}
          </div>
        ) : null}
        {imagenesPendientes.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: 8,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {imagenesPendientes.map((src, idx) => (
                <div key={`pend-${idx}-${src.slice(0, 24)}`} style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)",
                      objectFit: "cover",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setImagenesPendientes((prev) => prev.filter((_, i) => i !== idx))}
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
                    aria-label="Quitar imagen"
                  >
                    <X width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
              {imagenesPendientes.length === 1
                ? "Se enviará con el próximo mensaje"
                : `${imagenesPendientes.length} fotos en el próximo mensaje`}
            </p>
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
          placeholder="Escribe tu mensaje…"
          rows={3}
          disabled={loading}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            padding: "8px 12px",
            color: "#fff",
            outline: "none",
            fontSize: 14,
            fontFamily: "inherit",
            boxSizing: "border-box",
            opacity: loading ? 0.6 : 1,
          }}
        />
        <div style={{ display: "flex", minHeight: 44, alignItems: "stretch", gap: 8 }}>
          <button
            type="button"
            aria-label="Adjuntar imagen"
            disabled={loading || grabando}
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
              cursor: loading || grabando ? "not-allowed" : "pointer",
              opacity: loading || grabando ? 0.5 : 1,
            }}
          >
            <Paperclip width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            {...touchEnd(handleEnviar, loading || grabando || !puedeEnviar)}
            disabled={loading || grabando || !puedeEnviar}
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 8,
              padding: "10px 8px",
              fontWeight: 600,
              fontSize: 15,
              color: "#090b10",
              background: GREEN,
              border: "none",
              cursor: loading || grabando || !puedeEnviar ? "not-allowed" : "pointer",
              opacity: loading || grabando || !puedeEnviar ? 0.5 : 1,
            }}
          >
            {loading ? "Enviando…" : "Enviar"}
          </button>
          <button
            type="button"
            aria-label={grabando ? "Detener grabación" : "Grabar audio"}
            disabled={loading}
            onPointerDown={handleMicPointerDown(loading)}
            onClick={handleMicClick(loading)}
            style={micBtnStyle}
          >
            🎤
          </button>
        </div>
      </footer>
    </div>
  );
}

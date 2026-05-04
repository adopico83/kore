import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get("audio");

    const isBlobLike =
      audioBlob &&
      typeof audioBlob === "object" &&
      "arrayBuffer" in (audioBlob as object);

    if (!isBlobLike) {
      return NextResponse.json({ error: "Audio requerido" }, { status: 400 });
    }

    const blob = audioBlob as unknown as Blob;

    if (blob.size < 1000) {
      return NextResponse.json(
        { error: "Audio demasiado corto o vacío" },
        { status: 400 },
      );
    }

    let transcription;
    try {
      const fileMp3 = new File([blob], "audio.mp3", { type: "audio/mpeg" });
      transcription = await openai.audio.transcriptions.create({
        file: fileMp3,
        model: "whisper-1",
        language: "es",
      });
    } catch {
      const fileOgg = new File([blob], "audio.ogg", { type: "audio/ogg" });
      transcription = await openai.audio.transcriptions.create({
        file: fileOgg,
        model: "whisper-1",
        language: "es",
      });
    }

    const text = transcription.text;
    return NextResponse.json({ texto: text, text });
  } catch (err) {
    console.error("Error en /api/transcribe:", err);
    return NextResponse.json({ error: "Error al transcribir" }, { status: 500 });
  }
}

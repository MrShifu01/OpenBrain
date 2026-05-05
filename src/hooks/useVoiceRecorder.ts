import { useCallback, useRef, useState } from "react";
import { authFetch } from "../lib/authFetch";
import { getGroqKey } from "../lib/aiSettings";

const MIN_VOICE_BLOB_BYTES = 1000;
const VOICE_RECORDER_CHUNK_MS = 1000;

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  onStatus: (status: string | null) => void;
  onError: (message: string | null) => void;
  onLoading: (loading: boolean) => void;
}

export function useVoiceRecorder({
  onTranscript,
  onStatus,
  onError,
  onLoading,
}: UseVoiceRecorderOptions) {
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const startVoice = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      stopRecording();
      return;
    }

    const groqKey = getGroqKey();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = "audio/mp4";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus"))
        mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";

      const recorder = new MediaRecorder(
        stream,
        mimeType !== "audio/mp4" ? { mimeType } : undefined,
      );
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const actualMime = recorder.mimeType || mimeType;
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        if (blob.size < MIN_VOICE_BLOB_BYTES) return;

        onLoading(true);
        onStatus("transcribing");
        onError(null);
        // Client-side timing — pair with server [transcribe] timing log to
        // attribute the gap between user tap-to-stop and text appearing.
        const tStop = Date.now();
        try {
          // Send the audio blob directly as the request body. The previous
          // path FileReader.readAsDataURL'd the blob into base64 (blocked
          // the main thread, inflated bytes 33%) then wrapped it in JSON,
          // and the server decoded it back. Sending the raw Blob skips
          // both encode + decode hops — typical mobile clip drops 30-60%
          // off perceived latency. Content-Type is application/octet-stream
          // so Vercel's bodyParser hands the server a Buffer directly,
          // regardless of the codec variant in actualMime; the real mime
          // rides on the query string for the multipart we build for Groq.
          const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
          if (groqKey) headers["X-Groq-Api-Key"] = groqKey;
          const url = `/api/transcribe?mime=${encodeURIComponent(actualMime)}&language=en`;
          const transcribeRes = await authFetch(url, {
            method: "POST",
            headers,
            body: blob,
          });
          const tFetched = Date.now();
          console.log(
            `[voice] client timing — total=${tFetched - tStop}ms upload+server=${tFetched - tStop}ms blobBytes=${blob.size} mime=${actualMime}`,
          );
          if (transcribeRes.ok) {
            const {
              text: t,
              audioBytes,
              provider: txProvider,
              model: txModel,
            } = await transcribeRes.json();
            if (t?.trim()) onTranscript(t.trim());
            if (audioBytes) {
              import("../lib/usageTracker")
                .then((m) => {
                  m.recordUsage({
                    date: new Date().toISOString().slice(0, 10),
                    type: "transcription",
                    provider: txProvider || "groq",
                    model: txModel || "whisper-large-v3-turbo",
                    audioBytes,
                  });
                })
                .catch((err) =>
                  console.error("[useVoiceRecorder] recordUsage (transcription) failed", err),
                );
            }
          } else {
            const errBody = await transcribeRes.text().catch(() => "");
            onError(`[transcribe] HTTP ${transcribeRes.status} — ${errBody}`);
          }
        } catch (e) {
          onError(`[transcribe] ${e instanceof Error ? e.message : String(e)}`);
        }
        onLoading(false);
        onStatus(null);
      };

      recorder.start(VOICE_RECORDER_CHUNK_MS);
      setListening(true);
    } catch (e) {
      if (
        e instanceof Error &&
        (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")
      ) {
        onError("[voice] Microphone permission denied");
      } else {
        onError(`[voice] ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }, [stopRecording, onTranscript, onStatus, onError, onLoading]);

  const resetListening = useCallback(() => setListening(false), []);

  return { listening, startVoice, stopRecording, resetListening };
}

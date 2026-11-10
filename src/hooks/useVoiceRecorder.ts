import { useEffect, useRef, useState } from 'react';

export function useVoiceRecorder(enabled: boolean, onSend: (url: string) => void, onError: (message: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const active = useRef(enabled); active.current = enabled;
  const callbacks = useRef({ onSend, onError }); callbacks.current = { onSend, onError };
  const clearTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const cancel = () => {
    generation.current++;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    stream.current?.getTracks().forEach(track => track.stop());
    recorder.current = null; stream.current = null; busy.current = false; clearTimer();
  };
  useEffect(() => {
    if (!enabled) { cancel(); setIsRecording(false); setSeconds(0); }
    return cancel;
  }, [enabled]);

  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    clearTimer(); setIsRecording(false);
  };
  const start = async () => {
    if (busy.current || !active.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      callbacks.current.onError('Ses kaydı için HTTPS ve mikrofon izni gerekli.'); return;
    }
    busy.current = true;
    const request = ++generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (request !== generation.current || !active.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const recording = new MediaRecorder(media);
      recorder.current = recording;
      const chunks: Blob[] = [];
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        media.getTracks().forEach(track => track.stop()); clearTimer();
        recorder.current = null; stream.current = null;
        if (request !== generation.current || !active.current) return;
        setIsRecording(false); setSeconds(0);
        const blob = new Blob(chunks, { type: recording.mimeType || chunks[0]?.type || 'audio/webm' });
        if (!blob.size || blob.size > 2 * 1024 * 1024) {
          busy.current = false; callbacks.current.onError('Ses kaydı boş veya 2 MB sınırını aşıyor.'); return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (request !== generation.current || !active.current) return;
          if (typeof reader.result === 'string') callbacks.current.onSend(reader.result);
          busy.current = false;
        };
        reader.onerror = () => { if (request !== generation.current) return; busy.current = false; callbacks.current.onError('Ses kaydı okunamadı.'); };
        reader.readAsDataURL(blob);
      };
      recording.start(); setIsRecording(true); setSeconds(0);
      let elapsed = 0;
      timer.current = setInterval(() => { setSeconds(++elapsed); if (elapsed >= 120) stop(); }, 1000);
    } catch (error: any) {
      if (request !== generation.current) return;
      cancel(); setIsRecording(false); callbacks.current.onError('Mikrofon açılamadı: ' + (error?.message || 'İzin gerekli.'));
    }
  };
  return { isRecording, seconds, start, stop };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Dictado por voz para el cuadro de texto.
 * 1) Reconocimiento de voz del navegador (Chrome, Edge, Safari): el texto aparece mientras hablas.
 * 2) Si no existe o falla (Firefox, Brave…): se graba el audio, se convierte a WAV de 16 kHz y Atlas
 *    lo transcribe con Gemini.
 */

export type DictationState = 'idle' | 'listening' | 'recording' | 'transcribing';

const MAX_RECORDING_SECONDS = 180;

// Tipos mínimos de la Web Speech API (no todos los navegadores los declaran)
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Español del navegador si lo hay (es-CO, es-MX…), si no español genérico. */
function speechLang(): string {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.find((l) => l?.toLowerCase().startsWith('es')) ?? 'es-ES';
}

/** Añade lo dictado al texto que ya había, con un espacio de separación. */
function append(base: string, addition: string): string {
  const add = addition.trim();
  if (!add) return base;
  if (!base) return add;
  return /\s$/.test(base) ? base + add : `${base} ${add}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el audio'));
    reader.readAsDataURL(blob);
  });
}

/** WAV PCM de 16 bits. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** Convierte la grabación (webm/ogg/mp4 según el navegador) a WAV mono de 16 kHz, que Gemini siempre acepta. */
async function toWav16k(recording: Blob): Promise<Blob> {
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
  const AudioCtx = window.AudioContext ?? w.webkitAudioContext;
  const OfflineCtx = window.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!AudioCtx || !OfflineCtx) throw new Error('Tu navegador no puede procesar audio.');
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
    const rate = 16000;
    const offline = new OfflineCtx(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return encodeWav(rendered.getChannelData(0), rate);
  } finally {
    void ctx.close();
  }
}

interface Options {
  /** Texto actual del cuadro */
  getText: () => string;
  /** Escribe el texto en el cuadro (lo dictado se añade al final) */
  setText: (text: string) => void;
}

export function useDictation({ getText, setText }: Options) {
  const [state, setState] = useState<DictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recognitionRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelledRef = useRef(false);
  /** Tras un fallo del reconocimiento del navegador se usa la grabación */
  const preferRecorder = useRef(false);
  const supported = typeof window !== 'undefined' && (getRecognition() !== null || canRecord());

  const startRecording = useCallback(async () => {
    if (!canRecord()) {
      setError('Tu navegador no permite dictar por voz.');
      setState('idle');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(
        name === 'NotAllowedError'
          ? 'Permite el acceso al micrófono en el navegador para dictar.'
          : name === 'NotFoundError'
            ? 'No se encontró ningún micrófono.'
            : 'No se pudo usar el micrófono.'
      );
      setState('idle');
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && recorder.state === 'recording') recorder.stop();
    }, 1000);

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      window.clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      if (cancelledRef.current || chunks.length === 0) {
        setState('idle');
        return;
      }
      setState('transcribing');
      try {
        const wav = await toWav16k(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        const { text } = await api.transcribe(await blobToBase64(wav), 'audio/wav');
        if (text.trim()) setText(append(getText(), text));
        else setError('No se entendió el audio. Inténtalo de nuevo.');
      } catch (err) {
        setError((err as Error).message || 'No se pudo transcribir el audio.');
      } finally {
        setState('idle');
      }
    };

    cancelledRef.current = false;
    recorderRef.current = recorder;
    setSeconds(0);
    recorder.start();
    setState('recording');
  }, [getText, setText]);

  const startRecognition = useCallback(
    (Ctor: RecognitionCtor) => {
      cancelledRef.current = false;
      const base = getText();
      const recognition = new Ctor();
      recognition.lang = speechLang();
      recognition.interimResults = true;
      // En Chrome para Android el modo continuo duplica frases: allí se dicta frase a frase
      recognition.continuous = !/Android/i.test(navigator.userAgent);
      let finalText = '';
      let gotResults = false;
      let switched = false;

      recognition.onresult = (e) => {
        gotResults = true;
        let interim = '';
        finalText = '';
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i]!;
          if (result.isFinal) finalText += result[0].transcript;
          else interim += result[0].transcript;
        }
        setText(append(base, finalText + interim));
      };
      recognition.onerror = (e) => {
        if (e.error === 'aborted') return;
        if (['network', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
          // El servicio del navegador no está disponible (p. ej. Brave): se pasa a grabar y transcribir
          preferRecorder.current = true;
          if (!gotResults) {
            switched = true;
            void startRecording();
          }
          return;
        }
        setError(
          e.error === 'not-allowed'
            ? 'Permite el acceso al micrófono en el navegador para dictar.'
            : e.error === 'no-speech'
              ? 'No te escuché. Toca el micrófono e inténtalo de nuevo.'
              : e.error === 'audio-capture'
                ? 'No se encontró ningún micrófono.'
                : 'El dictado se detuvo. Inténtalo de nuevo.'
        );
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        // Descarta lo provisional que no llegó a confirmarse (salvo si se canceló: p. ej. al enviar el mensaje)
        if (gotResults && !cancelledRef.current) setText(append(base, finalText));
        if (!switched) setState((s) => (s === 'listening' ? 'idle' : s));
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setState('listening');
      } catch {
        recognitionRef.current = null;
        preferRecorder.current = true;
        void startRecording();
      }
    },
    [getText, setText, startRecording]
  );

  const start = useCallback(() => {
    setError(null);
    const Ctor = getRecognition();
    if (Ctor && !preferRecorder.current) startRecognition(Ctor);
    else void startRecording();
  }, [startRecognition, startRecording]);

  /** Termina de escuchar (lo dictado se queda en el cuadro; la grabación se transcribe). */
  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  /** Corta el dictado sin añadir nada más al cuadro (se usa al enviar el mensaje mientras escucha). */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recognitionRef.current?.abort();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setState('idle');
  }, []);

  // Al desmontar: se corta todo sin transcribir
  useEffect(
    () => () => {
      cancelledRef.current = true;
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);
  return { supported, state, error, seconds, start, stop, cancel, clearError };
}

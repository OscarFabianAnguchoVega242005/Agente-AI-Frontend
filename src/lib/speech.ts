import { useSyncExternalStore } from 'react';

/**
 * Lectura en voz alta de las respuestas con la síntesis de voz del navegador (gratis, sin servidor).
 * El texto se limpia de Markdown y se divide en frases cortas: Chrome corta las locuciones largas.
 */

let speakingId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Markdown → texto natural para leer en voz alta. */
export function markdownToSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (bloque de código omitido). ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'enlace')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')
    .replace(/^-{3,}$/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunks(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?¿¡;:]+[.!?;:]*\s*/g) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > max && current) {
      out.push(current.trim());
      current = '';
    }
    if (s.length > max) {
      for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
    } else {
      current += s;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const prefs = (navigator.languages ?? [navigator.language]).filter((l) => l?.toLowerCase().startsWith('es'));
  return (
    voices.find((v) => prefs.some((p) => v.lang.toLowerCase() === p.toLowerCase())) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('es'))
  );
}

export function stopSpeaking(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  speakingId = null;
  notify();
}

/** Lee el texto; `id` identifica la respuesta para mostrar su botón como activo. */
export function speak(id: string, markdown: string): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const parts = chunks(markdownToSpeech(markdown));
  if (parts.length === 0) return;
  const voice = spanishVoice();
  speakingId = id;
  notify();
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = voice?.lang ?? 'es-ES';
    if (voice) u.voice = voice;
    u.rate = 1.03;
    if (i === parts.length - 1) {
      u.onend = () => {
        if (speakingId === id) {
          speakingId = null;
          notify();
        }
      };
    }
    u.onerror = () => {
      if (speakingId === id) {
        speakingId = null;
        notify();
      }
    };
    window.speechSynthesis.speak(u);
  });
}

/** true mientras se lee la respuesta `id`. */
export function useSpeaking(id: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => speakingId === id,
    () => false
  );
}

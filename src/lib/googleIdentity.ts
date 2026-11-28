/**
 * Google Identity Services: botón oficial "Continuar con Google" en el propio dominio de Atlas.
 * Con este flujo Google devuelve un token de identidad a la página (no redirige a Supabase), así que
 * su ventana muestra la dirección de Atlas en lugar de la del proyecto de Supabase. Después Atlas
 * entrega ese token a Supabase con signInWithIdToken.
 */

/** ID de cliente OAuth de Google (público: aparece en cualquier inicio de sesión con Google). */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '687952471198-gptqoad6sb3vnqffhbft2elkvbpjgic2.apps.googleusercontent.com';

export interface CredentialResponse {
  credential: string;
}

export interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

let loading: Promise<GoogleIdentity> | null = null;

/** Carga el script de Google una sola vez. Falla si no carga a tiempo (bloqueadores, sin red…). */
export function loadGoogleIdentity(timeoutMs = 8000): Promise<GoogleIdentity> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('Google tardó demasiado en cargar')), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google no está disponible'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('No se pudo cargar el acceso de Google'));
    };
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    loading = null; // se puede reintentar
    throw err;
  });
  return loading;
}

/**
 * Nonce de un solo uso: Google lo incluye (cifrado con SHA-256) en el token y Supabase comprueba que
 * coincide con el original. Así un token interceptado no se puede reutilizar.
 */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

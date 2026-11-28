/**
 * Inicio de sesión con Google con un botón propio (diseño de Atlas).
 * Flujo OpenID Connect (response_type=id_token) en una ventana emergente: Google devuelve el token de
 * identidad a /auth/google en el propio dominio de Atlas (por eso su pantalla dice "Ir a <dominio de Atlas>"),
 * esa página se lo pasa a la ventana principal y Atlas lo entrega a Supabase con signInWithIdToken.
 * - state: evita respuestas falsificadas (CSRF). nonce: el token no se puede reutilizar.
 * - Si el navegador bloquea la ventana, se usa una redirección completa en la misma pestaña.
 */

/** ID de cliente OAuth de Google (público: aparece en cualquier inicio de sesión con Google). */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '687952471198-gptqoad6sb3vnqffhbft2elkvbpjgic2.apps.googleusercontent.com';

export const GOOGLE_CALLBACK_PATH = '/auth/google';
export const GOOGLE_POPUP_NAME = 'atlas-google-login';
const MESSAGE_TYPE = 'atlas-google-id-token';
const STORAGE_KEY = 'atlas.google_oauth';
const MAX_AGE_MS = 10 * 60 * 1000;

/** Intento en curso (en localStorage: la ventana emergente es otra pestaña y debe poder leerlo). */
export interface PendingGoogleLogin {
  state: string;
  nonce: string;
  createdAt: number;
}

export interface GoogleCallbackMessage {
  type: typeof MESSAGE_TYPE;
  state: string | null;
  idToken?: string;
  error?: GoogleAuthErrorCode;
}

export type GoogleAuthErrorCode = 'cancelled' | 'closed' | 'state' | 'missing' | 'google';

export class GoogleAuthError extends Error {
  constructor(public readonly code: GoogleAuthErrorCode, detail?: string) {
    super(detail ?? code);
  }
}

function randomBase64Url(bytes: number): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Nonce de un solo uso: Google recibe su SHA-256 y Supabase comprueba que coincide con el original. */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = randomBase64Url(32);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

export function readPendingLogin(): PendingGoogleLogin | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PendingGoogleLogin | null;
    if (!value || typeof value.state !== 'string' || typeof value.nonce !== 'string') return null;
    return Date.now() - value.createdAt < MAX_AGE_MS ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingLogin(): void {
  localStorage.removeItem(STORAGE_KEY);
}

async function prepareLogin(): Promise<{ url: string; pending: PendingGoogleLogin }> {
  const { raw, hashed } = await createNonce();
  const pending: PendingGoogleLogin = { state: randomBase64Url(16), nonce: raw, createdAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}`,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: hashed,
    state: pending.state,
    // Siempre deja elegir la cuenta (útil si tienes varias)
    prompt: 'select_account',
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, pending };
}

function popupFeatures(): string {
  const width = 480;
  const height = 640;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2.5));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

/**
 * Abre la ventana de Google y espera el token de identidad.
 * Hay que llamarla directamente desde el clic: la ventana se abre antes de cualquier espera para que el
 * navegador no la bloquee (Safari es estricto con esto).
 * Devuelve null si se usó la redirección completa (la página va a navegar a Google).
 */
export async function signInWithGooglePopup(): Promise<{ idToken: string; nonce: string } | null> {
  const popup = window.open('', GOOGLE_POPUP_NAME, popupFeatures());
  const { url, pending } = await prepareLogin();
  if (!popup || popup.closed) {
    window.location.assign(url); // ventanas emergentes bloqueadas
    return null;
  }
  popup.location.href = url;
  popup.focus();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as GoogleCallbackMessage | undefined;
      if (data?.type !== MESSAGE_TYPE || data.state !== pending.state) return;
      cleanup();
      clearPendingLogin();
      if (data.error || !data.idToken) reject(new GoogleAuthError(data.error ?? 'missing'));
      else resolve({ idToken: data.idToken, nonce: pending.nonce });
    };
    window.addEventListener('message', onMessage);
    // Si el usuario cierra la ventana sin terminar
    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new GoogleAuthError('closed'));
      }
    }, 600);
  });
}

/** En /auth/google: envía el resultado a la ventana principal (si sigue conectada). */
export function sendToOpener(message: Omit<GoogleCallbackMessage, 'type'>): boolean {
  try {
    const opener = window.opener as Window | null;
    if (!opener || opener.closed || opener.location.origin !== window.location.origin) return false;
    opener.postMessage({ type: MESSAGE_TYPE, ...message } satisfies GoogleCallbackMessage, window.location.origin);
    return true;
  } catch {
    return false; // la ventana principal es de otro origen o el navegador cortó la relación
  }
}

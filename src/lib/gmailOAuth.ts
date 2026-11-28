import { api } from './api';

/**
 * Conectar Gmail desde Conectores: autorización de Google en una ventana emergente.
 * Google vuelve a /auth/google (la misma página del inicio de sesión) con un código y un `state` que empieza
 * por "gmail."; esa página se lo pasa a la ventana principal y el servidor lo canjea y guarda el permiso cifrado.
 * - El `state` lo firma el servidor (ligado al usuario) y además se guarda aquí: liga la vuelta a este navegador.
 * - Si el navegador bloquea la ventana, se usa una redirección completa en la misma pestaña.
 */

export const GMAIL_POPUP_NAME = 'atlas-gmail-connect';
const MESSAGE_TYPE = 'atlas-gmail-code';
const STORAGE_KEY = 'atlas.gmail_oauth';
const NOTICE_KEY = 'atlas.connector_notice';
const MAX_AGE_MS = 10 * 60 * 1000;

export interface GmailConnectResult {
  email: string;
  avatar_url: string | null;
  /** Conectado, pero con algo pendiente (p. ej. activar la API de Gmail en Google Cloud) */
  warning?: string;
}

interface GmailCallbackMessage {
  type: typeof MESSAGE_TYPE;
  state: string | null;
  code?: string;
  error?: string;
}

export type GmailConnectErrorCode = 'closed' | 'cancelled' | 'google';

export class GmailConnectError extends Error {
  constructor(public readonly code: GmailConnectErrorCode, message: string) {
    super(message);
  }
}

/** ¿Es la vuelta de Google de una conexión de Gmail (y no un inicio de sesión)? */
export function isGmailState(state: string | null): boolean {
  return Boolean(state?.startsWith('gmail.'));
}

export function readPendingGmail(): string | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { state?: unknown; createdAt?: unknown } | null;
    if (!value || typeof value.state !== 'string' || typeof value.createdAt !== 'number') return null;
    return Date.now() - value.createdAt < MAX_AGE_MS ? value.state : null;
  } catch {
    return null;
  }
}

export function clearPendingGmail(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─────────────── Aviso para Conectores tras una redirección completa ───────────────

export type StoredNotice = { type: 'ok' | 'info' | 'error'; text: string };

export function storeConnectorNotice(notice: StoredNotice): void {
  sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
}

export function readConnectorNotice(): StoredNotice | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(NOTICE_KEY) ?? 'null') as StoredNotice | null;
    return value && typeof value.text === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function clearConnectorNotice(): void {
  sessionStorage.removeItem(NOTICE_KEY);
}

// ─────────────── Ventana de Google ───────────────

function popupFeatures(): string {
  const width = 500;
  const height = 680;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2.5));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

/** Mientras el servidor prepara la autorización (puede estar despertando), la ventana no se queda en blanco. */
function showLoading(popup: Window): void {
  try {
    popup.document.title = 'Atlas';
    popup.document.body.style.cssText =
      'margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#131314;color:#9aa0a6;font:14px system-ui,sans-serif';
    popup.document.body.textContent = 'Abriendo Google…';
  } catch {
    // no es importante
  }
}

function waitForCode(popup: Window, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedTimer);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as GmailCallbackMessage | undefined;
      if (data?.type !== MESSAGE_TYPE || data.state !== state) return;
      cleanup();
      if (data.code) resolve(data.code);
      else if (data.error === 'access_denied') reject(new GmailConnectError('cancelled', 'Cancelaste el acceso a Gmail.'));
      else reject(new GmailConnectError('google', `Google devolvió un error${data.error ? ` (${data.error})` : ''}. Vuelve a intentarlo.`));
    };
    window.addEventListener('message', onMessage);
    // El usuario cerró la ventana sin terminar (o Google mostró un error y la cerró)
    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new GmailConnectError('closed', 'Se cerró la ventana de Google.'));
      }
    }, 600);
  });
}

/**
 * Conecta Gmail. Hay que llamarla directamente desde el clic (la ventana se abre antes de cualquier espera).
 * Devuelve null si se usó la redirección completa (la página va a navegar a Google).
 */
export async function connectGmail({ onAuthorized }: { onAuthorized?: () => void } = {}): Promise<GmailConnectResult | null> {
  const popup = window.open('', GMAIL_POPUP_NAME, popupFeatures());
  if (popup) showLoading(popup);
  let start: { url: string; state: string };
  try {
    start = await api.gmailOAuthStart();
  } catch (err) {
    popup?.close();
    throw err;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: start.state, createdAt: Date.now() }));
  if (!popup || popup.closed) {
    window.location.assign(start.url); // ventanas emergentes bloqueadas
    return null;
  }
  popup.location.href = start.url;
  popup.focus();
  let code: string;
  try {
    code = await waitForCode(popup, start.state);
  } catch (err) {
    // Si solo se cerró la ventana, se conserva el intento: la propia ventana pudo terminar la conexión por su cuenta
    if (!(err instanceof GmailConnectError && err.code === 'closed')) clearPendingGmail();
    throw err;
  }
  clearPendingGmail();
  onAuthorized?.();
  return api.gmailOAuthExchange(code, start.state);
}

/** En /auth/google: envía el código a la ventana principal de Atlas (si sigue conectada). */
export function sendGmailToOpener(message: Omit<GmailCallbackMessage, 'type'>): boolean {
  try {
    const opener = window.opener as Window | null;
    if (!opener || opener.closed || opener.location.origin !== window.location.origin) return false;
    opener.postMessage({ type: MESSAGE_TYPE, ...message } satisfies GmailCallbackMessage, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

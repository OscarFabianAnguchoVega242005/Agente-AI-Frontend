import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { GOOGLE_CLIENT_ID, createNonce } from '../lib/googleAuth';

/**
 * Botón oficial de Google (Google Identity Services), como acceso de respaldo.
 * Solo necesita que el dominio de Atlas esté en "Orígenes autorizados de JavaScript" (no la URI de
 * redirección): sirve si el botón principal falla por la configuración de Google.
 */

interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce?: string;
    ux_mode?: 'popup' | 'redirect';
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

function loadGoogleIdentity(timeoutMs = 8000): Promise<GoogleIdentity> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('no disponible'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('no se pudo cargar'));
    };
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    loading = null;
    throw err;
  });
  return loading;
}

export function GoogleOfficialButton({
  onCredential,
  onError,
}: {
  /** Token de identidad de Google y el nonce original (Supabase comprueba que coinciden) */
  onCredential: (idToken: string, nonce: string) => void;
  onError: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const google = await loadGoogleIdentity();
        const { raw, hashed } = await createNonce();
        const container = ref.current;
        if (cancelled || !container) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          ux_mode: 'popup',
          context: 'signin',
          itp_support: true,
          callback: (response) => onCredential(response.credential, raw),
        });
        container.replaceChildren();
        google.renderButton(container, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.round(Math.min(400, Math.max(200, container.clientWidth))),
          locale: 'es',
        });
        setReady(true);
      } catch {
        if (!cancelled) onError('No se pudo cargar el acceso alternativo de Google. Revisa tu conexión o el bloqueador de anuncios.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onCredential, onError]);

  return (
    <div className="relative h-10">
      <div ref={ref} className={`w-full flex justify-center ${ready ? '' : 'invisible'}`} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="w-4 h-4 animate-spin text-zinc-500" />
        </div>
      )}
    </div>
  );
}

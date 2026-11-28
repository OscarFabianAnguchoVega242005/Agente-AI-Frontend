import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, TriangleAlert } from 'lucide-react';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../lib/supabase';
import { GOOGLE_CLIENT_ID, createNonce, loadGoogleIdentity, type GoogleIdentity } from '../lib/googleIdentity';
import { AtlasLogo } from './AtlasLogo';

/** Logo de Google para el botón de acceso (según las pautas de marca de "Acceder con Google"). */
function GoogleLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Proveedores de acceso activos en Supabase (su configuración de acceso es pública). */
type Providers = { google: boolean; email: boolean };

/** Error que Supabase devuelve en la URL si se cancela o falla el acceso con Google. */
function oauthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, ''));
  const code = params.get('error');
  const errorCode = params.get('error_code');
  const description = params.get('error_description');
  if (!code && !errorCode && !description) return null;
  // Se limpia la URL para que el error no se quede al recargar
  window.history.replaceState(null, '', window.location.pathname);
  // Primero los códigos concretos: Supabase usa error=access_denied también para otros motivos
  if (errorCode === 'signup_disabled' || /signups? not allowed|signup.*disabled/i.test(description ?? '')) {
    return 'Esta cuenta de Google no tiene acceso a Atlas.';
  }
  if (code === 'access_denied') return 'Cancelaste el acceso con Google.';
  return description ? `No se pudo entrar con Google: ${description}` : 'No se pudo entrar con Google.';
}

const inputCls =
  'w-full h-12 px-4 rounded-xl bg-[#1e1f20] border border-white/10 text-[15px] text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#8ab4f8]/60 transition';

/** Acceso con correo: solo de respaldo (Google sin activar o sin poder comprobarlo). No permite registrarse. */
function EmailSignIn({ onNotice }: { onNotice: (text: string | null) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    onNotice(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) onNotice(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Correo electrónico"
        aria-label="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputCls}
      />
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          required
          minLength={6}
          autoComplete="current-password"
          placeholder="Contraseña"
          aria-label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputCls} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={showPassword}
          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
        >
          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full h-12 rounded-full bg-white/10 hover:bg-white/15 text-zinc-100 font-medium text-[15px] disabled:opacity-50 flex items-center justify-center gap-2 transition active:scale-[0.99]"
      >
        {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
        Entrar con correo
      </button>
    </form>
  );
}

export function AuthScreen() {
  const [providers, setProviders] = useState<Providers | 'error' | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(oauthErrorFromUrl);
  const [showEmail, setShowEmail] = useState(false);

  // Botón oficial de Google (Google Identity Services)
  const [gis, setGis] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [signingIn, setSigningIn] = useState(false);
  const gisRef = useRef<HTMLDivElement>(null);
  const googleRef = useRef<GoogleIdentity | null>(null);
  const nonceRef = useRef('');
  const finishRef = useRef<(credential: string) => void>(() => undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s: { external?: Record<string, boolean> }) => {
        if (!cancelled) setProviders({ google: s.external?.google === true, email: s.external?.email === true });
      })
      .catch(() => {
        if (!cancelled) setProviders('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Con Google activado solo se muestra su botón. Mientras no lo esté, el correo sirve de respaldo para no
  // quedarse fuera; si no se pudo comprobar, el correo queda detrás de un enlace.
  const googleEnabled = providers !== null && (providers === 'error' || providers.google);
  const googlePending = providers !== null && providers !== 'error' && !providers.google;
  // Con Google activado se usa su botón oficial; si no carga (bloqueadores, sin red), el acceso por redirección
  const useOfficialButton = providers !== null && providers !== 'error' && providers.google && gis !== 'failed';

  /** Dibuja el botón oficial al ancho disponible (Google lo pide en píxeles, de 200 a 400). */
  const drawButton = useCallback(() => {
    const container = gisRef.current;
    const google = googleRef.current;
    if (!container || !google) return;
    const width = Math.round(Math.min(400, Math.max(200, container.clientWidth)));
    container.replaceChildren();
    google.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width,
      locale: 'es',
    });
  }, []);

  /** Prepara un intento de acceso: nonce nuevo y botón listo. */
  const setupGoogle = useCallback(async () => {
    const google = await loadGoogleIdentity();
    const { raw, hashed } = await createNonce();
    nonceRef.current = raw;
    googleRef.current = google;
    google.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      ux_mode: 'popup',
      context: 'signin',
      itp_support: true,
      callback: (response) => finishRef.current(response.credential),
    });
    drawButton();
  }, [drawButton]);

  // Google devuelve el token de identidad a la página y Supabase crea la sesión con él
  finishRef.current = (credential: string) => {
    setNotice(null);
    setSigningIn(true);
    void supabase.auth
      .signInWithIdToken({ provider: 'google', token: credential, nonce: nonceRef.current })
      .then(({ error }) => {
        if (!error) return; // App detecta la sesión y abre Atlas
        setSigningIn(false);
        setNotice(
          /signups? not allowed|signup.*disabled/i.test(error.message)
            ? 'Esta cuenta de Google no tiene acceso a Atlas.'
            : `No se pudo entrar con Google: ${error.message}`
        );
        void setupGoogle().catch(() => setGis('failed')); // el nonce es de un solo uso
      });
  };

  useEffect(() => {
    if (!(providers !== null && providers !== 'error' && providers.google)) return;
    let cancelled = false;
    setupGoogle()
      .then(() => {
        if (!cancelled) setGis('ready');
      })
      .catch(() => {
        if (!cancelled) setGis('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [providers, setupGoogle]);

  // Si cambia el ancho (girar el móvil, redimensionar), el botón se vuelve a dibujar a su medida
  useEffect(() => {
    const container = gisRef.current;
    if (gis !== 'ready' || !container || typeof ResizeObserver === 'undefined') return;
    let last = container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - last) < 16) return;
      last = container.clientWidth;
      drawButton();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [gis, drawButton]);

  const continueWithGoogle = async () => {
    setNotice(null);
    setRedirecting(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Siempre deja elegir la cuenta de Google (útil si tienes varias)
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setNotice(`No se pudo abrir el acceso con Google: ${error.message}`);
      setRedirecting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="min-h-full flex flex-col items-center justify-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:pt-6 [@media(max-height:560px)]:pb-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] max-w-[200vw] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(155,114,242,0.18),transparent)]"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-sm animate-rise">
          <div className="flex flex-col items-center text-center mb-8 [@media(max-height:560px)]:mb-5">
            <AtlasLogo className="w-12 h-12 [@media(max-height:560px)]:w-10 [@media(max-height:560px)]:h-10" />
            <h1 className="mt-5 [@media(max-height:560px)]:mt-3 text-[1.75rem] sm:text-3xl font-medium tracking-tight">
              Bienvenido a <span className="text-gradient">Atlas</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Tu agente autónomo de ingeniería y AppSec</p>
          </div>

          {notice && (
            <div
              role="alert"
              className="mb-3 text-sm px-4 py-3 rounded-xl border bg-red-500/[0.08] border-red-500/20 text-red-200 flex gap-2.5"
            >
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {useOfficialButton ? (
            <div className="relative h-10">
              {/* Aquí Google dibuja su botón oficial; mientras carga o se valida, se ve un marcador igual */}
              <div ref={gisRef} className={`w-full flex justify-center ${gis === 'ready' && !signingIn ? '' : 'invisible'}`} />
              {(gis !== 'ready' || signingIn) && (
                <div
                  aria-live="polite"
                  className="absolute inset-0 rounded-full bg-white text-[#1f1f1f] text-sm font-medium flex items-center justify-center gap-3 opacity-80"
                >
                  <LoaderCircle className="w-4 h-4 animate-spin text-zinc-500" />
                  {signingIn ? 'Entrando…' : 'Continuar con Google'}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void continueWithGoogle()}
              disabled={!googleEnabled || redirecting}
              className="w-full h-12 rounded-full bg-white hover:bg-zinc-100 text-[#1f1f1f] font-medium text-[15px] flex items-center justify-center gap-3 disabled:opacity-60 transition active:scale-[0.99] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
            >
              {providers === null || redirecting ? (
                <LoaderCircle className="w-5 h-5 animate-spin text-zinc-500" />
              ) : (
                <GoogleLogo />
              )}
              Continuar con Google
            </button>
          )}

          {googlePending && (
            <div className="mt-5 space-y-3">
              <p className="text-xs leading-relaxed text-amber-200/80 text-center px-2">
                El acceso con Google aún no está activado. Mientras tanto puedes entrar con tu correo.
              </p>
              <EmailSignIn onNotice={setNotice} />
            </div>
          )}

          {providers === 'error' &&
            (showEmail ? (
              <div className="mt-4">
                <EmailSignIn onNotice={setNotice} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="w-full h-11 mt-3 text-sm text-zinc-400 hover:text-zinc-200 transition"
              >
                ¿Problemas? Entra con tu correo
              </button>
            ))}

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
            Atlas usa tu nombre, correo y foto de Google para tu cuenta.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  LoaderCircle,
  Mic,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../lib/supabase';
import { GoogleAuthError, signInWithGooglePopup } from '../lib/googleAuth';
import { AtlasLogo } from './AtlasLogo';
import { CONTACT_EMAIL } from './LegalPage';
import { GoogleOfficialButton } from './GoogleOfficialButton';
import { GoogleLogo } from './GoogleLogo';

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

/** Qué hace Atlas: la página de inicio debe describir la app (lo exige Google para verificar la marca). */
const FEATURES: Array<{ icon: LucideIcon; text: string }> = [
  { icon: GitBranch, text: 'Programa en tus repositorios de GitHub: sube los cambios a una rama y abre un Pull Request.' },
  { icon: ShieldCheck, text: 'Revisa la seguridad de tu código: credenciales expuestas y vulnerabilidades.' },
  { icon: Globe, text: 'Investiga en internet y analiza imágenes, PDF y archivos de código.' },
  { icon: Mic, text: 'Le hablas por voz y puede leerte sus respuestas.' },
];

const legalLink = 'text-zinc-400 underline underline-offset-2 decoration-zinc-600 hover:text-zinc-200';

type GoogleState = 'idle' | 'waiting' | 'signing';

/**
 * Botón "Continuar con Google" con el diseño de Atlas (sigue las pautas de marca de Google: logo oficial,
 * fondo blanco y el texto "Continuar con Google"), con un brillo suave en los colores de Atlas.
 */
function GoogleButton({
  state,
  loading,
  disabled,
  onClick,
}: {
  state: GoogleState;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const busy = loading || state !== 'idle';
  const label =
    state === 'waiting' ? 'Continúa en la ventana de Google…' : state === 'signing' ? 'Entrando…' : 'Continuar con Google';
  return (
    <div className={`group relative ${disabled && !loading ? 'opacity-60' : ''}`}>
      {!disabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-full bg-[linear-gradient(90deg,#4F8CFF,#9B72F2,#E8836B)] opacity-25 blur-lg transition-opacity duration-300 group-hover:opacity-50"
        />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        aria-busy={busy}
        className="relative w-full h-12 rounded-full bg-white text-[#1f1f1f] text-[15px] font-medium flex items-center justify-center gap-3 px-5 shadow-[0_1px_2px_rgba(0,0,0,0.35)] ring-1 ring-black/5 transition-[background-color,transform] duration-150 hover:bg-[#f6f7f8] active:scale-[0.985] disabled:cursor-default disabled:hover:bg-white disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab4f8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131314]"
      >
        {busy ? (
          <LoaderCircle className="w-5 h-5 shrink-0 animate-spin text-zinc-500" />
        ) : (
          <GoogleLogo className="w-5 h-5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

export function AuthScreen() {
  const [providers, setProviders] = useState<Providers | 'error' | null>(null);
  const [notice, setNotice] = useState<string | null>(oauthErrorFromUrl);
  const [showEmail, setShowEmail] = useState(false);
  const [googleState, setGoogleState] = useState<GoogleState>('idle');
  /** Acceso de respaldo con el botón oficial de Google (0 = oculto; al cambiar, se prepara un intento nuevo) */
  const [altGoogle, setAltGoogle] = useState(0);

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

  // Google activado (o sin poder comprobarlo: se intenta igual). Mientras no esté activado, el correo sirve de
  // respaldo para no quedarse fuera.
  const googleOn = providers === 'error' || (providers !== null && providers.google);
  const googlePending = providers !== null && providers !== 'error' && !providers.google;

  // Debe llamarse directamente desde el clic: la ventana de Google se abre antes de cualquier espera
  const continueWithGoogle = () => {
    setNotice(null);
    setGoogleState('waiting');
    signInWithGooglePopup()
      .then(async (result) => {
        if (!result) return; // redirección completa a Google en curso
        setGoogleState('signing');
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
          nonce: result.nonce,
        });
        if (error) throw error;
        // App detecta la sesión y abre Atlas
      })
      .catch((err: unknown) => {
        setGoogleState('idle');
        if (err instanceof GoogleAuthError) {
          if (err.code === 'cancelled') return; // canceló en Google
          // La ventana se cerró sin terminar (p. ej. Google mostró un error de configuración): se ofrece el
          // botón oficial de Google, que no depende de la URI de redirección
          setAltGoogle((k) => k || 1);
          if (err.code === 'closed') return;
          setNotice(
            err.code === 'state'
              ? 'No se pudo verificar la respuesta de Google. Vuelve a intentarlo.'
              : 'Google no devolvió los datos de acceso. Vuelve a intentarlo.'
          );
          return;
        }
        const text = (err as Error)?.message ?? String(err);
        setNotice(
          /signups? not allowed|signup.*disabled/i.test(text)
            ? 'Esta cuenta de Google no tiene acceso a Atlas.'
            : `No se pudo entrar con Google: ${text}`
        );
      });
  };

  /** Token del botón oficial de Google → sesión en Supabase. */
  const finishOfficial = useCallback((idToken: string, nonce: string) => {
    setNotice(null);
    setGoogleState('signing');
    void supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce }).then(({ error }) => {
      if (!error) return; // App detecta la sesión y abre Atlas
      setGoogleState('idle');
      setNotice(
        /signups? not allowed|signup.*disabled/i.test(error.message)
          ? 'Esta cuenta de Google no tiene acceso a Atlas.'
          : `No se pudo entrar con Google: ${error.message}`
      );
      setAltGoogle((k) => k + 1); // nonce nuevo para el siguiente intento
    });
  }, []);

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="min-h-full flex flex-col items-center justify-center px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] [@media(max-height:560px)]:pt-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] max-w-[200vw] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(155,114,242,0.18),transparent)]"
          aria-hidden="true"
        />

        <main className="relative w-full max-w-sm animate-rise my-auto">
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
              className="mb-4 text-sm px-4 py-3 rounded-xl border bg-red-500/[0.08] border-red-500/20 text-red-200 flex gap-2.5"
            >
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <GoogleButton
            state={googleState}
            loading={providers === null}
            disabled={!googleOn}
            onClick={continueWithGoogle}
          />

          {altGoogle > 0 && googleOn && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2.5 animate-fade">
              <p className="text-xs leading-relaxed text-center text-zinc-400">
                ¿Google mostró un error? Prueba con su acceso oficial:
              </p>
              <GoogleOfficialButton key={altGoogle} onCredential={finishOfficial} onError={setNotice} />
            </div>
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

          <p className="mt-5 text-center text-xs leading-relaxed text-zinc-500">
            Al continuar aceptas los{' '}
            <a href="/terminos" className={legalLink}>
              Términos
            </a>{' '}
            y la{' '}
            <a href="/privacidad" className={legalLink}>
              Política de privacidad
            </a>
            . Atlas usa tu nombre, correo y foto de Google para tu cuenta.
          </p>

          <section aria-labelledby="atlas-features" className="mt-9 pt-6 border-t border-white/[0.06]">
            <h2 id="atlas-features" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Qué hace Atlas
            </h2>
            <ul className="mt-4 space-y-3">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-300">
                  <span className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-zinc-300" />
                  </span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer className="relative mt-8 flex items-center gap-1 text-xs text-zinc-500">
          <a href="/privacidad" className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Privacidad
          </a>
          <a href="/terminos" className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Términos
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center h-10 px-2.5 rounded-full hover:text-zinc-300">
            Contacto
          </a>
        </footer>
      </div>
    </div>
  );
}

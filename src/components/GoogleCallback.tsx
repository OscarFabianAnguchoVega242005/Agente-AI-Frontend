import { useEffect, useState } from 'react';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import {
  GOOGLE_POPUP_NAME,
  clearPendingLogin,
  readPendingLogin,
  sendToOpener,
  type GoogleAuthErrorCode,
} from '../lib/googleAuth';
import {
  GMAIL_POPUP_NAME,
  clearPendingGmail,
  isGmailState,
  readPendingGmail,
  sendGmailToOpener,
  storeConnectorNotice,
} from '../lib/gmailOAuth';
import { AtlasLogo } from './AtlasLogo';

const ERROR_TEXT: Record<GoogleAuthErrorCode, string> = {
  cancelled: 'Cancelaste el acceso con Google.',
  closed: 'Se cerró la ventana de Google.',
  state: 'No se pudo verificar la respuesta de Google. Vuelve a intentarlo desde Atlas.',
  missing: 'Google no devolvió los datos de acceso. Vuelve a intentarlo.',
  google: 'Google devolvió un error. Vuelve a intentarlo.',
};

/** Solo se procesa una vez (en desarrollo React monta los efectos dos veces). */
let handled = false;

/** Lee la respuesta de Google del fragmento de la URL y la borra (el token no debe quedarse en el historial). */
function takeResponse() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  window.history.replaceState(null, '', window.location.pathname);
  return { idToken: params.get('id_token'), state: params.get('state'), error: params.get('error') };
}

/** Vuelta de Google al conectar Gmail (?code=…&state=gmail.…): el código se canjea en el servidor. */
function finishGmail(query: URLSearchParams, setMessage: (text: string) => void) {
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');
  window.history.replaceState(null, '', window.location.pathname); // el código no se queda en el historial

  // Lo normal: la ventana de Conectores termina la conexión y esta se cierra
  if (sendGmailToOpener({ state, code: code ?? undefined, error: error ?? undefined })) {
    window.close();
    return;
  }

  // Sin ventana principal (redirección completa, o el navegador cortó la relación): se termina aquí
  const pending = readPendingGmail();
  clearPendingGmail();
  if (error) {
    setMessage(error === 'access_denied' ? 'Cancelaste el acceso a Gmail.' : `Google devolvió un error (${error}). Vuelve a intentarlo.`);
    return;
  }
  if (!code || !state || state !== pending) {
    setMessage('No se pudo verificar la respuesta de Google. Vuelve a intentarlo desde Conectores.');
    return;
  }
  void api
    .gmailOAuthExchange(code, state)
    .then((result) => {
      storeConnectorNotice(
        result.warning ? { type: 'info', text: result.warning } : { type: 'ok', text: `Gmail conectado: ${result.email}` }
      );
      if (window.name === GMAIL_POPUP_NAME) window.close(); // la ventana de Atlas recarga los conectores al cerrarse esta
      window.location.replace('/');
    })
    .catch((err: Error) => setMessage(err.message));
}

/** Página /auth/google: aquí vuelve Google al iniciar sesión (token de identidad) o al conectar Gmail (código). */
export function GoogleCallback() {
  const [message, setMessage] = useState<string | null>(null);
  const [gmail] = useState(() => isGmailState(new URLSearchParams(window.location.search).get('state')));

  useEffect(() => {
    if (handled) return;
    handled = true;
    if (gmail) {
      finishGmail(new URLSearchParams(window.location.search), setMessage);
      return;
    }

    const { idToken, state, error } = takeResponse();
    const pending = readPendingLogin();
    const code: GoogleAuthErrorCode | null = error
      ? error === 'access_denied'
        ? 'cancelled'
        : 'google'
      : !idToken
        ? 'missing'
        : !pending || state !== pending.state
          ? 'state'
          : null;

    // Lo normal: la ventana principal de Atlas termina el inicio de sesión y esta se cierra
    if (sendToOpener({ state, idToken: code ? undefined : (idToken ?? undefined), error: code ?? undefined })) {
      window.close();
      return;
    }

    // Sin ventana principal (redirección completa, o el navegador cortó la relación): se termina aquí
    clearPendingLogin();
    if (code || !idToken || !pending) {
      setMessage(ERROR_TEXT[code ?? 'missing']);
      return;
    }
    void supabase.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce: pending.nonce }).then(({ error: authError }) => {
      if (authError) {
        setMessage(
          /signups? not allowed|signup.*disabled/i.test(authError.message)
            ? 'Esta cuenta de Google no tiene acceso a Atlas.'
            : `No se pudo entrar con Google: ${authError.message}`
        );
        return;
      }
      // Si era la ventana emergente, la sesión ya llega sola a la pestaña de Atlas
      if (window.name === GOOGLE_POPUP_NAME) window.close();
      window.location.replace('/');
    });
  }, [gmail]);

  return (
    <div className="h-full flex items-center justify-center px-6 text-center">
      <div className="max-w-sm animate-fade">
        <AtlasLogo className="w-10 h-10 mx-auto" thinking={!message} />
        {message ? (
          <>
            <p className="mt-5 flex items-start justify-center gap-2 text-sm leading-relaxed text-red-200">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message}</span>
            </p>
            <a
              href="/"
              className="mt-5 inline-flex h-10 px-5 items-center rounded-full bg-white/10 hover:bg-white/15 text-sm font-medium text-zinc-100 transition"
            >
              Volver a Atlas
            </a>
          </>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <LoaderCircle className="w-4 h-4 animate-spin" /> {gmail ? 'Conectando Gmail…' : 'Conectando con Google…'}
          </p>
        )}
      </div>
    </div>
  );
}

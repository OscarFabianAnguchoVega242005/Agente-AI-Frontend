import { api } from './api';

const STATE_KEY = 'atlas.github_oauth_state';
export const GITHUB_CALLBACK_PATH = '/github/callback';

/** Pide la URL de autorización al backend y redirige a GitHub. */
export async function startGithubOAuth(): Promise<void> {
  const { url, state } = await api.githubOAuthStart();
  sessionStorage.setItem(STATE_KEY, state);
  window.location.assign(url);
}

export function isGithubCallback(): boolean {
  return window.location.pathname === GITHUB_CALLBACK_PATH;
}

/**
 * Procesa la vuelta desde GitHub: comprueba que el `state` coincide con el que
 * guardó este navegador y canjea el código en el backend.
 */
export async function completeGithubOAuth(): Promise<{ username: string }> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const ghError = params.get('error');
  const expected = sessionStorage.getItem(STATE_KEY);

  sessionStorage.removeItem(STATE_KEY);
  window.history.replaceState(null, '', '/');

  if (ghError) {
    throw new Error(
      ghError === 'access_denied' ? 'Cancelaste la autorización en GitHub.' : `GitHub devolvió un error: ${ghError}`
    );
  }
  if (!code || !state || !expected || state !== expected) {
    throw new Error('La autorización no es válida o caducó. Inténtalo de nuevo.');
  }

  const data = await api.githubOAuthExchange(code, state);
  return { username: data.username };
}

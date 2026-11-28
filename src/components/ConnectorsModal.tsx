import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ExternalLink, Github, LoaderCircle, Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';
import { startGithubOAuth } from '../lib/githubOAuth';
import type { GithubUser, RepoItem } from '../types';

export type Notice = { type: 'error' | 'ok' | 'info'; text: string } | null;

interface Props {
  open: boolean;
  onClose: () => void;
  ghConnected: boolean;
  oauthAvailable: boolean;
  ghUser: GithubUser | null;
  repos: RepoItem[];
  onChanged: () => Promise<void>;
  notice: Notice;
  onNotice: (notice: Notice) => void;
  /** true mientras se procesa la vuelta desde GitHub */
  completing: boolean;
}

export function ConnectorsModal({
  open,
  onClose,
  ghConnected,
  oauthAvailable,
  ghUser,
  repos,
  onChanged,
  notice,
  onNotice,
  completing,
}: Props) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const working = busy || completing;

  const connectOAuth = async () => {
    setBusy(true);
    onNotice(null);
    try {
      await startGithubOAuth(); // redirige a GitHub
    } catch (err) {
      onNotice({ type: 'error', text: (err as Error).message });
      setBusy(false);
    }
  };

  const connectToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    onNotice(null);
    try {
      const data = await api.connectGithub(token.trim());
      setToken('');
      await onChanged();
      onNotice({ type: 'ok', text: `Conectado como @${data.username}` });
    } catch (err) {
      onNotice({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    onNotice(null);
    try {
      await api.disconnect('github');
      await onChanged();
      onNotice({ type: 'ok', text: 'Cuenta de GitHub desvinculada.' });
    } catch (err) {
      onNotice({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const tokenForm = (
    <form onSubmit={connectToken} className="space-y-3">
      <label htmlFor="gh-token" className="block text-xs text-zinc-400">
        Personal Access Token con permiso <code className="text-zinc-200">repo</code>
      </label>
      <input
        id="gh-token"
        type="password"
        autoComplete="off"
        required
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="github_pat_… o ghp_…"
        className="w-full h-11 px-4 rounded-xl bg-[#1e1f20] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-[#8ab4f8]/60 transition"
      />
      <div className="flex flex-col-reverse items-stretch gap-2 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 text-xs text-[#8ab4f8] hover:underline flex items-center justify-center gap-1 whitespace-nowrap"
        >
          Crear token <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="submit"
          disabled={working || !token.trim()}
          className="h-11 min-[400px]:h-9 px-4 rounded-full bg-white/10 text-zinc-100 text-sm font-medium hover:bg-white/15 disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap transition"
        >
          {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
          Conectar con token
        </button>
      </div>
    </form>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connectors-title"
        className="relative w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-3xl bg-[#1e1f20] border border-white/10 border-b-0 sm:border-b shadow-2xl animate-sheet pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        {/* Asa de la hoja inferior (solo móvil) */}
        <div className="sm:hidden flex justify-center pt-2.5" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 sm:pt-6">
          <div>
            <h2 id="connectors-title" className="text-lg font-medium text-zinc-100">
              Conectores
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Da acceso a Atlas a tus herramientas.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-10 h-10 -mr-2 -mt-1 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-5 pb-6 sm:p-6 space-y-3">
          {/* GitHub */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#131314] p-4">
            <div className="flex items-center gap-3">
              {ghUser?.avatar_url ? (
                <img src={ghUser.avatar_url} alt="" className="w-10 h-10 shrink-0 rounded-full border border-white/10" />
              ) : (
                <span className="w-10 h-10 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <Github className="w-5 h-5 text-zinc-200" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">GitHub</span>
                  {ghConnected && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-300">
                      Conectado
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {ghConnected
                    ? `@${ghUser?.account_label ?? ''} · ${repos.length} repositorios`
                    : 'Lee repositorios y crea ramas de trabajo'}
                </p>
              </div>
              {ghConnected && (
                <button
                  onClick={() => void disconnect()}
                  disabled={working}
                  className="h-9 px-3 shrink-0 rounded-full text-xs text-red-300 border border-red-400/20 hover:bg-red-400/10 disabled:opacity-50 transition"
                >
                  Desconectar
                </button>
              )}
            </div>

            {!ghConnected && (
              <div className="mt-4 space-y-3">
                {oauthAvailable ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void connectOAuth()}
                      disabled={working}
                      className="w-full h-11 rounded-full bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition active:scale-[0.99]"
                    >
                      {working ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                      {completing ? 'Conectando…' : 'Conectar con GitHub'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      aria-expanded={showToken}
                      className="w-full h-9 flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                      Usar un token en su lugar
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showToken ? 'rotate-180' : ''}`} />
                    </button>
                    {showToken && <div className="pt-1">{tokenForm}</div>}
                  </>
                ) : (
                  tokenForm
                )}
              </div>
            )}
          </div>

          {/* Gmail (próximamente) */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#131314]/60 p-4 flex items-center gap-3 opacity-60">
            <span className="w-10 h-10 shrink-0 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Mail className="w-5 h-5 text-zinc-300" />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-200">Gmail</span>
              <p className="text-xs text-zinc-500 mt-0.5">Próximamente</p>
            </div>
            <Lock className="w-4 h-4 text-zinc-500" />
          </div>

          {notice && (
            <p
              className={`text-sm px-1 ${
                notice.type === 'error' ? 'text-red-300' : notice.type === 'ok' ? 'text-emerald-300' : 'text-zinc-300'
              }`}
            >
              {notice.text}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500 px-1 pt-1">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-px" />
            Los tokens se cifran con AES-256-GCM en el servidor antes de guardarse.
          </p>
        </div>
      </div>
    </div>
  );
}

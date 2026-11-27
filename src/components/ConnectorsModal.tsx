import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, FolderGit2, LoaderCircle, Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { api } from '../lib/api';
import type { GithubUser, RepoItem } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  ghConnected: boolean;
  ghUser: GithubUser | null;
  repos: RepoItem[];
  onChanged: () => Promise<void>;
}

export function ConnectorsModal({ open, onClose, ghConnected, ghUser, repos, onChanged }: Props) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  useEffect(() => {
    if (open) setMsg(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const data = await api.connectGithub(token.trim());
      setToken('');
      await onChanged();
      setMsg({ type: 'ok', text: `Conectado como @${data.username}` });
    } catch (err) {
      setMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.disconnect('github');
      await onChanged();
      setMsg({ type: 'ok', text: 'Cuenta de GitHub desvinculada.' });
    } catch (err) {
      setMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connectors-title"
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#1e1f20] border border-white/10 shadow-2xl animate-pop"
      >
        <div className="flex items-start justify-between px-6 pt-6">
          <div>
            <h2 id="connectors-title" className="text-lg font-medium text-zinc-100">
              Conectores
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Da acceso a Atlas a tus herramientas.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {/* GitHub */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#131314] p-4">
            <div className="flex items-center gap-3">
              {ghUser?.avatar_url ? (
                <img src={ghUser.avatar_url} alt="" className="w-10 h-10 rounded-full border border-white/10" />
              ) : (
                <span className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                  <FolderGit2 className="w-5 h-5 text-zinc-200" />
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
                  disabled={busy}
                  className="h-8 px-3 rounded-full text-xs text-red-300 border border-red-400/20 hover:bg-red-400/10 disabled:opacity-50 transition"
                >
                  Desconectar
                </button>
              )}
            </div>

            {!ghConnected && (
              <form onSubmit={connect} className="mt-4 space-y-3">
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
                <div className="flex items-center justify-between gap-3">
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1"
                  >
                    Crear token <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="submit"
                    disabled={busy || !token.trim()}
                    className="h-9 px-4 rounded-full bg-zinc-100 text-zinc-900 text-sm font-medium hover:bg-white disabled:opacity-40 flex items-center gap-2 transition"
                  >
                    {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
                    {busy ? 'Verificando…' : 'Conectar'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Gmail (próximamente) */}
          <div className="rounded-2xl border border-white/[0.05] bg-[#131314]/60 p-4 flex items-center gap-3 opacity-60">
            <span className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Mail className="w-5 h-5 text-zinc-300" />
            </span>
            <div className="flex-1">
              <span className="text-sm font-medium text-zinc-200">Gmail</span>
              <p className="text-xs text-zinc-500 mt-0.5">Próximamente</p>
            </div>
            <Lock className="w-4 h-4 text-zinc-500" />
          </div>

          {msg && (
            <p className={`text-sm px-1 ${msg.type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{msg.text}</p>
          )}

          <p className="flex items-center gap-2 text-xs text-zinc-500 px-1 pt-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            Los tokens se cifran con AES-256-GCM en el servidor antes de guardarse.
          </p>
        </div>
      </div>
    </div>
  );
}

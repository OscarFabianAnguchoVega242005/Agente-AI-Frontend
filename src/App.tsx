import React, { useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  Terminal,
  GitBranch,
  ShieldAlert,
  Sparkles,
  Plug,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  LogOut,
  Trash2,
  FolderGit2,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { supabase, API_BASE_URL } from './lib/supabase';

type AgentMode = 'vibecoding' | 'appsec' | 'general';

interface RepoItem {
  name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
}

interface TaskSummary {
  id: string;
  prompt: string;
  mode: AgentMode;
  target_repo: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
}

interface AgentStep {
  id: string;
  step_number: number;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string;
}

interface TaskDetail extends TaskSummary {
  final_response: string | null;
  error_message: string | null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'console' | 'connectors'>('console');
  const [initialLoading, setInitialLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [ghConnected, setGhConnected] = useState(false);
  const [ghUser, setGhUser] = useState<{ account_label: string; avatar_url?: string } | null>(null);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [ghTokenInput, setGhTokenInput] = useState('');
  const [connectorLoading, setConnectorLoading] = useState(false);
  const [connectorMsg, setConnectorMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<AgentMode>('vibecoding');
  const [targetRepo, setTargetRepo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [copiedOutput, setCopiedOutput] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    }),
    [session?.access_token]
  );

  const loadData = useCallback(async () => {
    if (!session) return;
    setInitialLoading(true);
    setBackendError(null);
    try {
      const [connRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/connectors`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/api/tasks`, { headers: authHeaders() }),
      ]);

      if (!connRes.ok || !tasksRes.ok) {
        throw new Error('El servidor en Render está despertando o devolvió un error. Reintenta en unos segundos.');
      }

      const connData = await connRes.json();
      setGhConnected(Boolean(connData.github?.connected));
      setGhUser(connData.github?.user ?? null);
      const repoList: RepoItem[] = connData.github?.repos ?? [];
      setRepos(repoList);
      setTargetRepo((prev) => (prev ? prev : repoList[0]?.name ?? ''));

      const tasksData = await tasksRes.json();
      setTasks(tasksData.tasks ?? []);
    } catch (err) {
      setBackendError((err as Error).message);
    } finally {
      setInitialLoading(false);
    }
  }, [session, authHeaders]);

  useEffect(() => {
    if (session) {
      void loadData();
    }
  }, [session, loadData]);

  useEffect(() => {
    if (!session || !selectedTaskId) return;
    let cancelled = false;

    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${selectedTaskId}`, {
          headers: authHeaders(),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setTaskDetail(data.task);
        setSteps(data.steps ?? []);
        if (data.task?.status === 'completed' || data.task?.status === 'failed') {
          void loadData();
        }
      } catch {
        // Silenciar error transitorio en polling
      }
    };

    void fetchDetail();
    const interval = setInterval(() => {
      if (!taskDetail || taskDetail.status === 'running' || taskDetail.status === 'pending') {
        void fetchDetail();
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, selectedTaskId, taskDetail?.status, authHeaders, loadData]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthNotice(null);
    setAuthBusy(true);
    try {
      const { error } = isRegister
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthNotice({ type: 'error', text: error.message });
      } else if (isRegister) {
        setAuthNotice({
          type: 'ok',
          text: 'Cuenta registrada. Si Supabase exige confirmación por correo revísalo, o inicia sesión directamente.',
        });
        setIsRegister(false);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghTokenInput.trim()) return;
    setConnectorLoading(true);
    setConnectorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/connectors/github`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ token: ghTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo validar el token en GitHub');
      setGhTokenInput('');
      setConnectorMsg({ type: 'ok', text: `Conectado correctamente como @${data.username}` });
      await loadData();
    } catch (err) {
      setConnectorMsg({ type: 'error', text: (err as Error).message });
    } finally {
      setConnectorLoading(false);
    }
  };

  const handleDisconnectGithub = async () => {
    setConnectorLoading(true);
    setConnectorMsg(null);
    try {
      await fetch(`${API_BASE_URL}/api/connectors/github`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setGhConnected(false);
      setGhUser(null);
      setRepos([]);
      setTargetRepo('');
      setConnectorMsg({ type: 'ok', text: 'Cuenta de GitHub desvinculada.' });
    } finally {
      setConnectorLoading(false);
    }
  };

  const handleLaunchTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setTaskDetail(null);
    setSteps([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: prompt.trim(),
          mode,
          targetRepo: targetRepo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error lanzando tarea');
      setSelectedTaskId(data.taskId);
      setPrompt('');
      await loadData();
    } catch (err) {
      setBackendError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyResult = () => {
    const text = taskDetail?.final_response ?? taskDetail?.error_message ?? '';
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] p-4">
        <form
          onSubmit={handleAuth}
          className="w-full max-w-sm bg-[#111113] border border-white/10 rounded-xl p-6 space-y-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5 text-zinc-100 font-semibold text-lg">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Terminal className="w-5 h-5 text-emerald-400" />
            </div>
            <span>Agente Autónomo</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Accede a tu espacio de trabajo para gestionar tus conectores y ejecutar tareas de ingeniería y AppSec.
          </p>

          {authNotice && (
            <div
              className={`text-xs p-3 rounded-lg border ${
                authNotice.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {authNotice.text}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              required
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#09090B] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={authBusy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm py-2.5 rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {authBusy && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setAuthNotice(null);
            }}
            className="w-full text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col">
      <header className="h-14 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between bg-[#111113] sticky top-0 z-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Agente AI</span>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === 'console'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Consola
            </button>
            <button
              onClick={() => setActiveTab('connectors')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                activeTab === 'connectors'
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Plug className="w-3.5 h-3.5" />
              Conectores
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ghConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadData()}
            title="Sincronizar con servidor"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initialLoading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-zinc-400 hidden md:inline">{session.user.email}</span>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {backendError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{backendError}</span>
          </div>
          <button
            onClick={() => void loadData()}
            className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {activeTab === 'connectors' ? (
        <main className="max-w-2xl w-full mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-lg font-semibold">Conectores de Cuenta</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Vincula tus integraciones a tu cuenta personal. Los tokens se cifran con AES-256-GCM en el backend antes de guardarse.
            </p>
          </div>

          <div className="bg-[#111113] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {ghUser?.avatar_url ? (
                  <img
                    src={ghUser.avatar_url}
                    alt={ghUser.account_label}
                    className="w-9 h-9 rounded-full border border-white/10"
                  />
                ) : (
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <FolderGit2 className="w-5 h-5 text-zinc-200" />
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-medium">GitHub</h2>
                  <p className="text-xs text-zinc-400">
                    {ghConnected
                      ? `Conectado como @${ghUser?.account_label} · ${repos.length} repositorios detectados`
                      : 'Sin vincular'}
                  </p>
                </div>
              </div>

              {ghConnected && (
                <button
                  onClick={() => void handleDisconnectGithub()}
                  disabled={connectorLoading}
                  className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              )}
            </div>

            {!ghConnected && (
              <form onSubmit={handleConnectGithub} className="space-y-3 pt-3 border-t border-white/5">
                <label className="block text-xs text-zinc-400">
                  Pega un Personal Access Token de GitHub (con permiso <code className="text-zinc-200">repo</code>):
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    required
                    placeholder="github_pat_... o ghp_..."
                    value={ghTokenInput}
                    onChange={(e) => setGhTokenInput(e.target.value)}
                    className="flex-1 bg-[#09090B] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={connectorLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs transition active:scale-[0.98]"
                  >
                    {connectorLoading ? 'Verificando...' : 'Conectar GitHub'}
                  </button>
                </div>
              </form>
            )}

            {connectorMsg && (
              <p
                className={`text-xs ${
                  connectorMsg.type === 'error' ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {connectorMsg.text}
              </p>
            )}
          </div>
        </main>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#111113]/40 p-4 space-y-3">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Historial ({tasks.length})
            </div>

            {initialLoading && tasks.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500">Aún no hay ejecuciones registradas.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] lg:max-h-[calc(100vh-130px)] overflow-y-auto pr-1">
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition ${
                      selectedTaskId === t.id
                        ? 'bg-white/10 border-white/20'
                        : 'bg-[#111113] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="uppercase text-[10px] font-semibold text-emerald-400">
                        {t.mode}
                      </span>
                      <span
                        className={`text-[10px] ${
                          t.status === 'completed'
                            ? 'text-emerald-400'
                            : t.status === 'failed'
                              ? 'text-red-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-zinc-200">{t.prompt}</p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="lg:col-span-9 p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-6">
            {!ghConnected && !initialLoading && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-amber-200">
                  Conecta tu cuenta de GitHub para que el agente pueda leer tus repositorios y crear ramas de trabajo.
                </span>
                <button
                  onClick={() => setActiveTab('connectors')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold shrink-0 transition"
                >
                  Ir a Conectores
                </button>
              </div>
            )}

            <form
              onSubmit={handleLaunchTask}
              className="bg-[#111113] border border-white/10 rounded-xl p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'vibecoding', label: 'Vibecoding', icon: Sparkles },
                    { id: 'appsec', label: 'Auditoría AppSec', icon: ShieldAlert },
                    { id: 'general', label: 'General', icon: GitBranch },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setMode(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
                        mode === item.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#09090B] border-white/10 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}

                <select
                  value={targetRepo}
                  onChange={(e) => setTargetRepo(e.target.value)}
                  className="sm:ml-auto bg-[#09090B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Sin repositorio fijo</option>
                  {repos.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name} {r.private ? '(privado)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                rows={3}
                required
                placeholder="Ej: Revisa el repositorio seleccionado, audita vulnerabilidades OWASP y sube un parche en una rama agent/fix-security..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Ejecutar Agente
                </button>
              </div>
            </form>

            {taskDetail && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-[#111113] border border-white/10 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    {(taskDetail.status === 'running' || taskDetail.status === 'pending') && (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    )}
                    {taskDetail.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {taskDetail.status === 'failed' && (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="font-medium capitalize">Estado: {taskDetail.status}</span>
                  </div>
                  {taskDetail.target_repo && (
                    <span className="text-xs text-zinc-400 font-mono">{taskDetail.target_repo}</span>
                  )}
                </div>

                {steps.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      Traza de herramientas ({steps.length})
                    </h3>
                    {steps.map((s) => (
                      <div
                        key={s.id}
                        className="bg-[#111113] border border-white/10 rounded-lg p-3 text-xs space-y-1"
                      >
                        <div className="font-mono text-emerald-400">
                          #{s.step_number} → {s.tool_name}
                        </div>
                        <pre className="text-[11px] text-zinc-400 overflow-x-auto">
                          {JSON.stringify(s.tool_input)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {(taskDetail.final_response || taskDetail.error_message) && (
                  <div className="bg-[#111113] border border-white/10 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                        Resultado del Agente
                      </h3>
                      <button
                        onClick={handleCopyResult}
                        className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-zinc-300 flex items-center gap-1.5 transition"
                      >
                        {copiedOutput ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {taskDetail.final_response ?? taskDetail.error_message}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
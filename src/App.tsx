import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LoaderCircle, Menu, Plug, RefreshCw, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
import { displayName } from './lib/format';
import { AuthScreen } from './components/AuthScreen';
import { AtlasLogo } from './components/AtlasLogo';
import { Sidebar } from './components/Sidebar';
import { Composer } from './components/Composer';
import { ChatView } from './components/ChatView';
import { Greeting, Suggestions } from './components/Welcome';
import { ConnectorsModal } from './components/ConnectorsModal';
import {
  isFinished,
  type AgentMode,
  type AgentStep,
  type GithubUser,
  type RepoItem,
  type TaskDetail,
  type TaskSummary,
} from './types';

const SIDEBAR_KEY = 'atlas.sidebar.expanded';

function taskIdFromUrl(): string | null {
  const match = /^#\/t\/([0-9a-f-]{36})$/i.exec(window.location.hash);
  return match?.[1] ?? null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <AtlasLogo className="w-10 h-10" thinking />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  // La key reinicia todo el estado del espacio de trabajo al cambiar de usuario.
  return <Workspace key={session.user.id} email={session.user.email ?? ''} />;
}

function Workspace({ email }: { email: string }) {
  // Conectores
  const [ghConnected, setGhConnected] = useState(false);
  const [ghUser, setGhUser] = useState<GithubUser | null>(null);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [connectorsOpen, setConnectorsOpen] = useState(false);

  // Tareas
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(taskIdFromUrl);
  const [detail, setDetail] = useState<{ task: TaskDetail; steps: AgentStep[] } | null>(null);

  // Composer
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<AgentMode>('vibecoding');
  const [targetRepo, setTargetRepo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ prompt: string; mode: AgentMode; targetRepo: string | null } | null>(
    null
  );

  // UI
  const [error, setError] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== '0');
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadConnectors = useCallback(async () => {
    const data = await api.getConnectors();
    setGhConnected(Boolean(data.github?.connected));
    setGhUser(data.github?.user ?? null);
    const list = data.github?.repos ?? [];
    setRepos(list);
    setTargetRepo((prev) => (prev && list.some((r) => r.name === prev) ? prev : (list[0]?.name ?? '')));
  }, []);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await api.listTasks();
      setTasks(data.tasks ?? []);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setError(null);
    const results = await Promise.allSettled([loadConnectors(), loadTasks()]);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) setError((failed.reason as Error).message);
  }, [loadConnectors, loadTasks]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarExpanded ? '1' : '0');
  }, [sidebarExpanded]);

  // Navegación con atrás/adelante del navegador
  useEffect(() => {
    const onPop = () => setSelectedId(taskIdFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((id: string | null) => {
    const url = id ? `#/t/${id}` : window.location.pathname + window.location.search;
    if (window.location.hash !== (id ? `#/t/${id}` : '')) window.history.pushState(null, '', url);
    setSelectedId(id);
    setMobileOpen(false);
  }, []);

  // Polling de la tarea seleccionada hasta que termine
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail((prev) => (prev?.task.id === selectedId ? prev : null));

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await api.getTask(selectedId);
        if (cancelled) return;
        setDetail(data);
        setTasks((prev) => prev.map((t) => (t.id === data.task.id ? { ...t, status: data.task.status } : t)));
        if (isFinished(data.task.status)) return;
      } catch (err) {
        if (cancelled) return;
        if ((err as { status?: number }).status === 404) {
          setError('No se encontró esa tarea.');
          navigate(null);
          return;
        }
      }
      timer = setTimeout(() => void tick(), 2500);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedId, navigate]);

  const submitTask = async () => {
    const text = draft.trim();
    if (text.length < 3 || submitting) return;

    const repo = targetRepo || null;
    setSubmitting(true);
    setPending({ prompt: text, mode, targetRepo: repo });
    setDraft('');
    navigate(null);

    try {
      const { taskId } = await api.createTask({ prompt: text, mode, targetRepo: repo ?? undefined });
      setTasks((prev) => [
        {
          id: taskId,
          prompt: text,
          mode,
          target_repo: repo,
          status: 'running',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      navigate(taskId);
    } catch (err) {
      setError((err as Error).message);
      setDraft(text);
    } finally {
      setPending(null);
      setSubmitting(false);
    }
  };

  const openConnectors = () => {
    setMobileOpen(false);
    setConnectorsOpen(true);
  };

  // Datos de la conversación visible
  const summary = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;
  const conversation = pending
    ? { prompt: pending.prompt, mode: pending.mode, targetRepo: pending.targetRepo, task: null, steps: [] }
    : selectedId
      ? {
          prompt: detail?.task.prompt ?? summary?.prompt ?? '',
          mode: detail?.task.mode ?? summary?.mode ?? 'general',
          targetRepo: detail?.task.target_repo ?? summary?.target_repo ?? null,
          task: detail?.task ?? null,
          steps: detail?.steps ?? [],
        }
      : null;

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={() => void submitTask()}
      mode={mode}
      onModeChange={setMode}
      repos={repos}
      targetRepo={targetRepo}
      onRepoChange={setTargetRepo}
      ghConnected={ghConnected}
      onOpenConnectors={openConnectors}
      submitting={submitting}
      placeholder={conversation ? 'Envía una nueva tarea a Atlas' : 'Pídele algo a Atlas'}
      autoFocus
    />
  );

  return (
    <div className="h-full flex">
      <Sidebar
        expanded={sidebarExpanded}
        onToggleExpanded={() => setSidebarExpanded((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        tasks={tasks}
        loading={tasksLoading}
        selectedId={selectedId}
        onSelect={navigate}
        onNew={() => navigate(null)}
        email={email}
        ghConnected={ghConnected}
        onOpenConnectors={openConnectors}
        onSignOut={() => void supabase.auth.signOut()}
      />

      <div className="flex-1 min-w-0 h-full flex flex-col">
        <header className="h-16 shrink-0 flex items-center gap-2 px-3 sm:px-5">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/[0.08]"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(null)}
            className="flex items-center gap-2 px-2 h-10 rounded-xl hover:bg-white/[0.04] transition"
          >
            <span className="text-xl font-medium tracking-tight text-zinc-100">Atlas</span>
          </button>

          {!ghConnected && !tasksLoading && (
            <button
              onClick={openConnectors}
              className="ml-auto h-9 px-3.5 rounded-full text-xs text-amber-200 bg-amber-400/10 hover:bg-amber-400/15 flex items-center gap-1.5 transition"
            >
              <Plug className="w-3.5 h-3.5" /> Conectar GitHub
            </button>
          )}
        </header>

        {error && (
          <div className="px-4 animate-fade">
            <div className="max-w-3xl mx-auto mb-2 rounded-2xl bg-[#3a1f1f] border border-red-400/20 px-4 py-2.5 flex items-center gap-3 text-sm text-red-100">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => void loadAll()}
                className="flex items-center gap-1.5 text-xs font-medium text-red-100/90 hover:text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reintentar
              </button>
              <button onClick={() => setError(null)} aria-label="Cerrar aviso" className="text-red-100/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {conversation ? (
          <>
            <main className="flex-1 min-h-0 overflow-y-auto">
              {conversation.prompt ? (
                <ChatView
                  key={selectedId ?? 'pending'}
                  prompt={conversation.prompt}
                  mode={conversation.mode}
                  targetRepo={conversation.targetRepo}
                  task={conversation.task}
                  steps={conversation.steps}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <LoaderCircle className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              )}
            </main>
            <div className="shrink-0 px-3 sm:px-6 pb-3">
              <div className="max-w-3xl mx-auto">
                {composer}
                <p className="text-center text-xs text-zinc-500 mt-2.5">
                  Atlas puede cometer errores. Revisa las ramas antes de hacer merge.
                </p>
              </div>
            </div>
          </>
        ) : (
          <main className="flex-1 min-h-0 overflow-y-auto">
            <div className="min-h-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col justify-center gap-8 py-10">
              <Greeting name={displayName(email)} />
              {composer}
              <Suggestions
                onPick={(s) => {
                  setMode(s.mode);
                  setDraft(s.prompt);
                }}
              />
            </div>
          </main>
        )}
      </div>

      <ConnectorsModal
        open={connectorsOpen}
        onClose={() => setConnectorsOpen(false)}
        ghConnected={ghConnected}
        ghUser={ghUser}
        repos={repos}
        onChanged={loadConnectors}
      />
    </div>
  );
}

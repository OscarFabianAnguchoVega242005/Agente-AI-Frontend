import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LoaderCircle, Menu, Plug, RefreshCw, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
import { chatTitle, displayName } from './lib/format';
import { AuthScreen } from './components/AuthScreen';
import { AtlasLogo } from './components/AtlasLogo';
import { Sidebar } from './components/Sidebar';
import { Composer } from './components/Composer';
import { ChatView, type ChatTurn } from './components/ChatView';
import { Greeting, Suggestions } from './components/Welcome';
import { ConnectorsModal, type Notice } from './components/ConnectorsModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PreviewPanel, type PreviewState } from './components/PreviewPanel';
import { extractFiles, isHtmlFile, type CodeFile } from './lib/files';
import { completeGithubOAuth, isGithubCallback } from './lib/githubOAuth';
import {
  isFinished,
  repoId,
  type AgentMode,
  type ConversationTurn,
  type GithubUser,
  type RepoItem,
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
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(isGithubCallback);
  const [connectorNotice, setConnectorNotice] = useState<Notice>(null);
  const [oauthCompleting, setOauthCompleting] = useState(isGithubCallback);
  const oauthHandled = useRef(false);

  // Conversaciones (cada una es una tarea raíz con sus mensajes de seguimiento)
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(taskIdFromUrl);
  const [convo, setConvo] = useState<{ id: string; turns: ConversationTurn[] } | null>(null);
  const [pollKey, setPollKey] = useState(0);

  // Composer
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<AgentMode>('vibecoding');
  const [targetRepo, setTargetRepo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** Mensaje recién enviado que aún no aparece en la conversación cargada del servidor. */
  const [pending, setPending] = useState<{
    prompt: string;
    mode: AgentMode;
    targetRepo: string | null;
    conversationId: string | null;
    taskId?: string;
  } | null>(null);

  // Eliminar chat
  const [deleteTarget, setDeleteTarget] = useState<TaskSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Vista previa de lo que construye Atlas
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const seenRunning = useRef(new Set<string>());
  const autoOpened = useRef(new Set<string>());

  // UI
  const [error, setError] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== '0');
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadConnectors = useCallback(async () => {
    const data = await api.getConnectors();
    setGhConnected(Boolean(data.github?.connected));
    setOauthAvailable(Boolean(data.github?.oauthAvailable));
    setGhUser(data.github?.user ?? null);
    const list = data.github?.repos ?? [];
    setRepos(list);
    // Nunca se preselecciona un repositorio: solo se conserva el que el usuario eligió, si sigue existiendo
    setTargetRepo((prev) => (prev && list.some((r) => repoId(r) === prev) ? prev : ''));
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

  /** Actualiza solo los títulos de los chats (Atlas los genera tras cada respuesta). */
  const refreshTitles = useCallback(async () => {
    try {
      const data = await api.listTasks();
      const titles = new Map((data.tasks ?? []).map((t) => [t.id, t.title ?? null]));
      setTasks((prev) => prev.map((t) => (titles.has(t.id) ? { ...t, title: titles.get(t.id) ?? t.title } : t)));
    } catch {
      // no es crítico
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

  // Vuelta desde GitHub tras pulsar "Autorizar" (/github/callback?code=…&state=…)
  useEffect(() => {
    if (!isGithubCallback() || oauthHandled.current) return;
    oauthHandled.current = true;
    completeGithubOAuth()
      .then(async ({ username }) => {
        await loadConnectors().catch(() => undefined);
        setConnectorNotice({ type: 'ok', text: `Conectado como @${username}` });
      })
      .catch((err: Error) => setConnectorNotice({ type: 'error', text: err.message }))
      .finally(() => setOauthCompleting(false));
  }, [loadConnectors]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarExpanded ? '1' : '0');
  }, [sidebarExpanded]);

  // Navegación con atrás/adelante del navegador
  useEffect(() => {
    const onPop = () => {
      setTargetRepo('');
      setSelectedId(taskIdFromUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((id: string | null) => {
    const url = id ? `#/t/${id}` : window.location.pathname + window.location.search;
    if (window.location.hash !== (id ? `#/t/${id}` : '')) window.history.pushState(null, '', url);
    setSelectedId(id);
    setMobileOpen(false);
  }, []);

  /** Cambio de chat iniciado por el usuario: el repositorio vuelve a "Sin repositorio" por seguridad. */
  const openChat = useCallback(
    (id: string | null) => {
      setTargetRepo('');
      setPreview(null);
      navigate(id);
    },
    [navigate]
  );

  // Polling de la conversación seleccionada mientras algún mensaje siga en curso
  useEffect(() => {
    if (!selectedId) {
      setConvo(null);
      return;
    }
    setConvo((prev) => (prev?.id === selectedId ? prev : null));

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sawBusy = false;
    const titleTimers: Array<ReturnType<typeof setTimeout>> = [];

    const tick = async () => {
      try {
        const { turns } = await api.getConversation(selectedId);
        if (cancelled) return;
        setConvo({ id: selectedId, turns });
        setPending((p) => (p?.taskId && turns.some((t) => t.task.id === p.taskId) ? null : p));

        const busy = turns.some((t) => !isFinished(t.task.status));
        const lastStatus = turns[turns.length - 1]?.task.status;
        setTasks((prev) =>
          prev.map((t) => (t.id === selectedId ? { ...t, status: busy ? 'running' : (lastStatus ?? t.status) } : t))
        );
        if (busy) sawBusy = true;
        if (!busy) {
          // El título se genera justo después de la respuesta: se consulta un par de veces
          if (sawBusy) titleTimers.push(setTimeout(() => void refreshTitles(), 2500), setTimeout(() => void refreshTitles(), 7000));
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if ((err as { status?: number }).status === 404) {
          setError('No se encontró ese chat.');
          navigate(null);
          return;
        }
      }
      timer = setTimeout(() => void tick(), 1200);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      titleTimers.forEach(clearTimeout);
    };
  }, [selectedId, pollKey, navigate, refreshTitles]);

  const currentTurns = convo && convo.id === selectedId ? convo.turns : [];
  const showPending = pending !== null && pending.conversationId === selectedId;
  const convoBusy = showPending || currentTurns.some((t) => !isFinished(t.task.status));

  const submitTask = async () => {
    const text = draft.trim();
    if (!text || submitting || convoBusy) return;

    const repo = targetRepo || null;
    const continuing = selectedId; // null = chat nuevo
    setSubmitting(true);
    setPending({ prompt: text, mode, targetRepo: repo, conversationId: continuing });
    setDraft('');

    try {
      const { taskId, conversationId } = await api.createTask({
        prompt: text,
        mode,
        targetRepo: repo ?? undefined,
        conversationId: continuing ?? undefined,
      });
      const now = new Date().toISOString();
      setPending({ prompt: text, mode, targetRepo: repo, conversationId, taskId });

      if (continuing) {
        // Sube el chat al principio del historial y vuelve a consultar
        setTasks((prev) => {
          const current = prev.find((t) => t.id === continuing);
          if (!current) return prev;
          return [{ ...current, status: 'running', updated_at: now }, ...prev.filter((t) => t.id !== continuing)];
        });
        setPollKey((k) => k + 1);
      } else {
        setTasks((prev) => [
          {
            id: conversationId,
            prompt: text,
            mode,
            target_repo: repo,
            status: 'running',
            created_at: now,
            updated_at: now,
          },
          ...prev,
        ]);
        navigate(conversationId);
      }
    } catch (err) {
      setError((err as Error).message);
      setDraft(text);
      setPending(null);
    } finally {
      setSubmitting(false);
    }
  };

  const renameChat = async (id: string, title: string) => {
    const previous = tasks.find((t) => t.id === id)?.title ?? null;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      await api.renameConversation(id, title);
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: previous } : t)));
      setError((err as Error).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteConversation(deleteTarget.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) navigate(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openConnectors = () => {
    setMobileOpen(false);
    if (!oauthCompleting) setConnectorNotice(null);
    setConnectorsOpen(true);
  };

  // Turnos visibles: los del servidor + el mensaje recién enviado
  const chatTurns: ChatTurn[] = [
    ...currentTurns.map((t) => ({
      key: t.task.id,
      prompt: t.task.prompt,
      mode: t.task.mode,
      targetRepo: t.task.target_repo,
      task: t.task,
      steps: t.steps,
    })),
    ...(showPending && pending
      ? [
          {
            key: pending.taskId ?? 'pending',
            prompt: pending.prompt,
            mode: pending.mode,
            targetRepo: pending.targetRepo,
            task: null,
            steps: [],
          },
        ]
      : []),
  ];
  const inConversation = selectedId !== null || showPending;
  const currentChat = selectedId ? tasks.find((t) => t.id === selectedId) : undefined;

  const openPreview = useCallback((files: CodeFile[], preferred?: string) => {
    const html = files.filter(isHtmlFile);
    const entry =
      (preferred ? html.find((f) => f.path === preferred) : undefined) ??
      html.find((f) => /(^|\/)index\.html?$/i.test(f.path)) ??
      html[0];
    if (entry) setPreview({ files, entry: entry.path });
  }, []);

  // Abre la vista previa sola cuando una respuesta recién terminada trae una página HTML
  // (no al abrir chats antiguos: solo respuestas que se vieron "en curso" en esta sesión)
  useEffect(() => {
    if (pending?.taskId) seenRunning.current.add(pending.taskId);
    for (const t of currentTurns) if (!isFinished(t.task.status)) seenRunning.current.add(t.task.id);

    const last = currentTurns[currentTurns.length - 1];
    if (!last || last.task.status !== 'completed') return;
    const id = last.task.id;
    if (!seenRunning.current.has(id) || autoOpened.current.has(id)) return;
    autoOpened.current.add(id);

    const files = extractFiles(last.task.final_response ?? '');
    if (files.some(isHtmlFile)) openPreview(files);
  }, [currentTurns, pending, openPreview]);

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
      ownLogin={ghUser?.account_label}
      submitting={submitting || convoBusy}
      placeholder={
        convoBusy ? 'Atlas está respondiendo…' : inConversation ? 'Responde a Atlas' : 'Pídele algo a Atlas'
      }
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
        onSelect={openChat}
        onRequestDelete={setDeleteTarget}
        onRename={(id, title) => void renameChat(id, title)}
        onNew={() => openChat(null)}
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
            onClick={() => openChat(null)}
            className="flex items-center gap-2 px-2 h-10 rounded-xl hover:bg-white/[0.04] transition"
          >
            <span className="text-xl font-medium tracking-tight text-zinc-100">Atlas</span>
          </button>
          {currentChat && (
            <span className="min-w-0 truncate text-sm text-zinc-400 max-sm:hidden" title={chatTitle(currentChat)}>
              <span className="text-zinc-600 mr-2">/</span>
              {chatTitle(currentChat)}
            </span>
          )}

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

        {inConversation ? (
          <>
            <main className="flex-1 min-h-0 overflow-y-auto">
              {chatTurns.length > 0 ? (
                <ChatView key={selectedId ?? 'new'} turns={chatTurns} onPreview={openPreview} />
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

      {preview && (
        <PreviewPanel
          preview={preview}
          onClose={() => setPreview(null)}
          onChangeEntry={(entry) => setPreview((p) => (p ? { ...p, entry } : p))}
        />
      )}

      <ConnectorsModal
        open={connectorsOpen}
        onClose={() => setConnectorsOpen(false)}
        ghConnected={ghConnected}
        oauthAvailable={oauthAvailable}
        ghUser={ghUser}
        repos={repos}
        onChanged={loadConnectors}
        notice={connectorNotice}
        onNotice={setConnectorNotice}
        completing={oauthCompleting}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="¿Eliminar chat?"
        message={`Se eliminará "${deleteTarget ? chatTitle(deleteTarget).slice(0, 80) : ''}" con todos sus mensajes. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

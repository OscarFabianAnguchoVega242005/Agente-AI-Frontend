import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Check, ChevronDown, FolderGit2, LoaderCircle, Lock, Plug, Search } from 'lucide-react';
import { MODE_OPTIONS } from '../lib/modes';
import { usePopover } from '../hooks/usePopover';
import { repoId, type AgentMode, type RepoItem } from '../types';

const MAX_CHARS = 8000;

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  repos: RepoItem[];
  targetRepo: string;
  onRepoChange: (repo: string) => void;
  ghConnected: boolean;
  onOpenConnectors: () => void;
  ownLogin?: string;
  submitting: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

function ModeMenu({ mode, onChange }: { mode: AgentMode; onChange: (m: AgentMode) => void }) {
  const { open, setOpen, ref } = usePopover();
  const current = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0]!;
  const Icon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 px-3 rounded-full flex items-center gap-1.5 text-sm text-zinc-300 hover:bg-white/[0.06] transition"
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl p-1.5 z-30 animate-pop">
          <div className="px-3 pt-2 pb-1.5 text-xs text-zinc-500">Modo del agente</div>
          {MODE_OPTIONS.map((m) => {
            const MIcon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.06] transition"
              >
                <MIcon className="w-4 h-4 mt-0.5 text-zinc-300 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-zinc-100">{m.label}</span>
                  <span className="block text-xs text-zinc-400 mt-0.5">{m.description}</span>
                </span>
                {m.id === mode && <Check className="w-4 h-4 mt-0.5 text-[#8ab4f8] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RepoMenu({
  repos,
  value,
  onChange,
  ghConnected,
  onOpenConnectors,
  ownLogin,
}: {
  repos: RepoItem[];
  value: string;
  onChange: (repo: string) => void;
  ghConnected: boolean;
  onOpenConnectors: () => void;
  ownLogin?: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => repoId(r).toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  if (!ghConnected) {
    return (
      <button
        type="button"
        onClick={onOpenConnectors}
        className="h-9 px-3 rounded-full flex items-center gap-1.5 text-sm text-amber-300/90 hover:bg-amber-400/10 transition"
      >
        <Plug className="w-4 h-4" />
        <span className="hidden sm:inline">Conectar GitHub</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery('');
        }}
        className="h-9 px-3 rounded-full flex items-center gap-1.5 text-sm text-zinc-300 hover:bg-white/[0.06] transition max-w-[220px]"
      >
        <FolderGit2 className="w-4 h-4 shrink-0" />
        <span className="truncate">{value ? (value.split('/').pop() ?? value) : 'Sin repositorio'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl z-30 animate-pop overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="flex items-center gap-2 px-2.5 h-9 rounded-xl bg-black/20">
              <Search className="w-4 h-4 text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar repositorio"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {!query && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.06]"
              >
                <span className="flex-1 text-left">Sin repositorio fijo</span>
                {value === '' && <Check className="w-4 h-4 text-[#8ab4f8]" />}
              </button>
            )}
            {filtered.map((r) => (
              <button
                key={repoId(r)}
                type="button"
                onClick={() => {
                  onChange(repoId(r));
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
              >
                <span className="flex-1 min-w-0 text-left truncate">
                  {r.name}
                  {r.full_name && r.full_name.split('/')[0] !== ownLogin && (
                    <span className="text-zinc-500"> · {r.full_name.split('/')[0]}</span>
                  )}
                </span>
                {r.private && <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                {value === repoId(r) && <Check className="w-4 h-4 text-[#8ab4f8] shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  mode,
  onModeChange,
  repos,
  targetRepo,
  onRepoChange,
  ghConnected,
  onOpenConnectors,
  ownLogin,
  submitting,
  placeholder = 'Pídele algo a Atlas',
  autoFocus = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length >= 1 && value.length <= MAX_CHARS && !submitting;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSend) onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-[28px] bg-[#1e1f20] border border-white/[0.08] focus-within:border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.35)] transition-colors"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-6 pt-5 pb-2 text-[15px] leading-6 text-zinc-100 placeholder:text-zinc-500 outline-none"
      />
      <div className="flex items-center gap-1 px-3 pb-3">
        <ModeMenu mode={mode} onChange={onModeChange} />
        <RepoMenu
          repos={repos}
          value={targetRepo}
          onChange={onRepoChange}
          ghConnected={ghConnected}
          onOpenConnectors={onOpenConnectors}
          ownLogin={ownLogin}
        />
        <div className="ml-auto flex items-center gap-3">
          {value.length > MAX_CHARS - 1000 && (
            <span className={`text-xs ${value.length > MAX_CHARS ? 'text-red-400' : 'text-zinc-500'}`}>
              {value.length}/{MAX_CHARS}
            </span>
          )}
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Enviar"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 text-zinc-900 hover:bg-white disabled:bg-white/10 disabled:text-zinc-500 transition active:scale-95"
          >
            {submitting ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </form>
  );
}

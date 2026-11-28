import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Check, ChevronDown, FolderGit2, LoaderCircle, Lock, Plug, Search } from 'lucide-react';
import { MODE_OPTIONS, modeMeta } from '../lib/modes';
import { usePopover } from '../hooks/usePopover';
import { COARSE_POINTER } from '../hooks/useMediaQuery';
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

/*
 * Los menús se anclan al propio cuadro de texto (el <form> es un contenedor con position).
 * Si el cuadro es estrecho (< 32rem: móviles, o escritorio con la vista previa abierta), el envoltorio
 * de cada botón pasa a `static` y el menú ocupa todo el ancho del cuadro, sin salirse de la pantalla.
 */
const popoverWrap = 'relative @max-lg:static';
const popoverPanel =
  'absolute bottom-full mb-2 left-0 @max-lg:right-0 rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl z-30 animate-pop';
const toolbarBtn = 'h-9 pointer-coarse:h-10 px-2.5 @md:px-3 rounded-full flex items-center gap-1.5 text-sm transition';

function ModeMenu({ mode, onChange }: { mode: AgentMode; onChange: (m: AgentMode) => void }) {
  const { open, setOpen, ref } = usePopover();
  const current = modeMeta(mode);
  const Icon = current.icon;

  return (
    <div ref={ref} className={popoverWrap}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Modo del agente: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${toolbarBtn} shrink-0 text-zinc-300 hover:bg-white/[0.06]`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="hidden @min-[22rem]:inline">{current.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
      </button>

      {open && (
        <div
          role="menu"
          className={`${popoverPanel} w-80 @max-lg:w-auto p-1.5 max-h-[min(26rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain`}
        >
          <div className="px-3 pt-2 pb-1.5 text-xs text-zinc-500">Modo del agente</div>
          {MODE_OPTIONS.map((m) => {
            const MIcon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={m.id === mode}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.06] transition"
              >
                <MIcon className="w-4 h-4 mt-0.5 text-zinc-300 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-zinc-100">{m.label}</span>
                  <span className="block text-xs leading-relaxed text-zinc-400 mt-0.5">{m.description}</span>
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
        className={`${toolbarBtn} min-w-0 text-amber-300/90 hover:bg-amber-400/10`}
      >
        <Plug className="w-4 h-4 shrink-0" />
        <span className="truncate">
          <span className="hidden @min-[24rem]:inline">Conectar </span>GitHub
        </span>
      </button>
    );
  }

  const label = value ? (value.split('/').pop() ?? value) : 'Sin repositorio';
  // En pantallas táctiles no se enfoca la búsqueda: abriría el teclado y taparía la lista
  const focusSearch = !window.matchMedia(COARSE_POINTER).matches;

  return (
    <div ref={ref} className={`${popoverWrap} min-w-0`}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery('');
        }}
        aria-label={`Repositorio: ${value || 'ninguno'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={value || 'Sin repositorio'}
        className={`${toolbarBtn} min-w-0 max-w-full @md:max-w-[15rem] text-zinc-300 hover:bg-white/[0.06]`}
      >
        <FolderGit2 className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      {open && (
        <div className={`${popoverPanel} w-80 @max-lg:w-auto overflow-hidden`}>
          <div className="p-2 border-b border-white/5">
            <label className="flex items-center gap-2 px-2.5 h-10 rounded-xl bg-black/20">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                autoFocus={focusSearch}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar repositorio"
                aria-label="Buscar repositorio"
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>
          <div role="listbox" className="max-h-[min(16rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain p-1.5">
            {!query && (
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 min-h-10 pointer-coarse:min-h-11 rounded-xl text-sm text-zinc-300 hover:bg-white/[0.06]"
              >
                <span className="flex-1 text-left">Sin repositorio fijo</span>
                {value === '' && <Check className="w-4 h-4 text-[#8ab4f8] shrink-0" />}
              </button>
            )}
            {filtered.map((r) => (
              <button
                key={repoId(r)}
                type="button"
                role="option"
                aria-selected={value === repoId(r)}
                onClick={() => {
                  onChange(repoId(r));
                  setOpen(false);
                }}
                title={repoId(r)}
                className="w-full flex items-center gap-2 px-3 min-h-10 pointer-coarse:min-h-11 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
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
            {filtered.length === 0 && <div className="px-3 py-4 text-xs text-zinc-500 text-center">Sin resultados</div>}
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

  // Crece con el texto; el tope real lo marca max-height (más bajo en pantallas cortas)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSend) onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // En pantallas táctiles Intro hace salto de línea (el teclado no tiene Mayús+Intro); se envía con el botón
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia(COARSE_POINTER).matches) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="@container relative w-full rounded-[26px] @md:rounded-[28px] bg-[#1e1f20] border border-white/[0.08] focus-within:border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.35)] transition-colors"
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Mensaje para Atlas"
        enterKeyHint="enter"
        className="block w-full resize-none bg-transparent px-4 @md:px-6 pt-3.5 tall:@md:pt-5 pb-1 tall:@md:pb-2 text-base @md:text-[15px] leading-6 text-zinc-100 placeholder:text-zinc-500 outline-none max-h-[min(240px,32dvh)] overflow-y-auto"
      />
      <div className="flex items-center gap-0.5 @md:gap-1 px-1.5 @md:px-3 pb-1.5 tall:@md:pb-3">
        <ModeMenu mode={mode} onChange={onModeChange} />
        <RepoMenu
          repos={repos}
          value={targetRepo}
          onChange={onRepoChange}
          ghConnected={ghConnected}
          onOpenConnectors={onOpenConnectors}
          ownLogin={ownLogin}
        />
        <div className="ml-auto pl-1 flex items-center gap-2 @md:gap-3 shrink-0">
          {value.length > MAX_CHARS - 1000 && (
            <span className={`text-xs tabular-nums ${value.length > MAX_CHARS ? 'text-red-400' : 'text-zinc-500'}`}>
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

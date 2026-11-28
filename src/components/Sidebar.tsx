import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { LogOut, Menu, MoreHorizontal, Pencil, Plug, Search, SquarePen, Trash2, X } from 'lucide-react';
import { chatTitle, groupTasksByDate } from '../lib/format';
import { usePopover } from '../hooks/usePopover';
import { AtlasLogo } from './AtlasLogo';
import type { TaskSummary } from '../types';

interface Props {
  expanded: boolean;
  onToggleExpanded: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  tasks: TaskSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRequestDelete: (task: TaskSummary) => void;
  onRename: (id: string, title: string) => void;
  onNew: () => void;
  email: string;
  /** Nombre y foto de la cuenta de Google (vacíos si se entró con correo) */
  fullName?: string;
  avatarUrl?: string;
  ghConnected: boolean;
  onOpenConnectors: () => void;
  onSignOut: () => void;
}

function UserAvatar({ email, name, avatarUrl }: { email: string; name?: string; avatarUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        // Las fotos de Google a veces no cargan si se envía el origen de la página
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-full shrink-0 object-cover bg-white/10"
      />
    );
  }
  return (
    <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white bg-linear-to-br from-[#4F8CFF] via-[#9B72F2] to-[#E8836B]">
      {((name || email).charAt(0) || '?').toUpperCase()}
    </span>
  );
}

function StatusDot({ status }: { status: TaskSummary['status'] }) {
  if (status === 'running' || status === 'pending') {
    return <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] animate-pulse shrink-0" title="En curso" />;
  }
  if (status === 'failed') {
    return <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Falló" />;
  }
  return null;
}

const MENU_WIDTH = 192;

/**
 * Menú de un chat (renombrar / eliminar). Se posiciona con `fixed` junto al botón para que
 * la lista con scroll no lo recorte, y se cierra al tocar fuera, hacer scroll o pulsar Escape.
 */
function ChatMenu({
  anchor,
  trigger,
  onClose,
  onRename,
  onDelete,
}: {
  anchor: DOMRect;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const height = el.offsetHeight;
    const left = Math.min(Math.max(margin, anchor.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - margin);
    const below = anchor.bottom + 4;
    const top = below + height + margin <= window.innerHeight ? below : Math.max(margin, anchor.top - height - 4);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    };
    // Escape cierra solo este menú (no el menú lateral): se captura antes y no se propaga
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    // Se cierra solo si el botón se movió de verdad (el menú quedaría desplazado). Así no lo cierran
    // el scroll del chat de fondo ni el último evento de una lista que aún frenaba al tocar
    const onScroll = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect || Math.abs(rect.top - anchor.top) > 4 || Math.abs(rect.left - anchor.left) > 4) onClose();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, trigger, anchor]);

  const item =
    'w-full flex items-center gap-3 px-3 h-10 pointer-coarse:h-11 rounded-xl text-sm text-left transition';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl p-1.5 animate-pop"
      style={{ width: MENU_WIDTH, top: pos?.top ?? anchor.bottom + 4, left: pos?.left ?? anchor.right - MENU_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onRename();
        }}
        className={`${item} text-zinc-200 hover:bg-white/[0.06]`}
      >
        <Pencil className="w-4 h-4 shrink-0" /> Cambiar nombre
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onDelete();
        }}
        className={`${item} text-red-300 hover:bg-red-400/10`}
      >
        <Trash2 className="w-4 h-4 shrink-0" /> Eliminar
      </button>
    </div>
  );
}

function ChatItem({
  task,
  selected,
  onSelect,
  onRename,
  onRequestDelete,
}: {
  task: TaskSummary;
  selected: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRequestDelete: (task: TaskSummary) => void;
}) {
  const label = chatTitle(task);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const startEditing = () => {
    setValue(label);
    setEditing(true);
  };

  const commit = () => {
    const next = value.trim().slice(0, 80);
    setEditing(false);
    if (next && next !== label) onRename(task.id, next);
  };

  // Siempre visible en pantallas táctiles (no hay hover), en el chat abierto y con el menú abierto
  const moreVisible =
    selected || menuAnchor
      ? 'opacity-100'
      : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100';

  return (
    <div
      className={`group relative w-full h-9 pointer-coarse:h-11 rounded-full flex items-center text-sm transition ${
        selected ? 'bg-[#1f3760] text-[#d3e3fd]' : 'text-zinc-300 hover:bg-white/[0.06]'
      }`}
    >
      {editing ? (
        <input
          autoFocus
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          aria-label="Nuevo nombre del chat"
          className="flex-1 min-w-0 h-7 pointer-coarse:h-9 mx-1.5 px-2.5 rounded-full bg-black/30 border border-[#8ab4f8]/50 text-zinc-100 outline-none"
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => onSelect(task.id)}
            onDoubleClick={startEditing}
            title={label}
            className="flex-1 min-w-0 h-full pl-3 pointer-coarse:pl-3.5 pr-1 flex items-center gap-2 text-left"
          >
            <span className="flex-1 truncate">{label}</span>
            <StatusDot status={task.status} />
          </button>
          <button
            ref={moreRef}
            type="button"
            onClick={() => setMenuAnchor(menuAnchor ? null : (moreRef.current?.getBoundingClientRect() ?? null))}
            aria-label={`Opciones del chat ${label}`}
            aria-haspopup="menu"
            aria-expanded={menuAnchor !== null}
            title="Opciones"
            className={`w-8 h-8 pointer-coarse:w-10 pointer-coarse:h-10 mr-0.5 rounded-full shrink-0 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.08] transition ${moreVisible}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </>
      )}

      {menuAnchor && (
        <ChatMenu
          anchor={menuAnchor}
          trigger={moreRef}
          onClose={() => setMenuAnchor(null)}
          onRename={startEditing}
          onDelete={() => onRequestDelete(task)}
        />
      )}
    </div>
  );
}

export function Sidebar({
  expanded,
  onToggleExpanded,
  mobileOpen,
  onCloseMobile,
  tasks,
  loading,
  selectedId,
  onSelect,
  onRequestDelete,
  onRename,
  onNew,
  email,
  fullName,
  avatarUrl,
  ghConnected,
  onOpenConnectors,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState('');
  const userMenu = usePopover();
  const full = expanded || mobileOpen;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? tasks.filter((t) => `${t.title ?? ''} ${t.prompt}`.toLowerCase().includes(q)) : tasks;
    return groupTasksByDate(list);
  }, [tasks, query]);

  // Escape cierra el menú lateral en móvil
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const iconBtn =
    'w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/[0.08] transition shrink-0';
  const rowBtn = `h-10 pointer-coarse:h-11 rounded-full flex items-center gap-3 text-sm hover:bg-white/[0.08] transition ${
    full ? 'w-full px-2.5' : 'w-10 justify-center'
  }`;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden animate-fade" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        aria-label="Chats"
        className={`bg-[#1b1c1d] flex flex-col h-full z-40 transition-[width] duration-200 ease-out max-lg:[@media(max-height:520px)]:overflow-y-auto max-lg:[@media(max-height:520px)]:overscroll-contain
          ${
            mobileOpen
              ? 'fixed inset-y-0 left-0 w-[min(86vw,300px)] shadow-2xl animate-drawer rounded-r-3xl lg:rounded-none pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
              : 'hidden'
          }
          lg:flex lg:static lg:shadow-none lg:p-0 ${expanded ? 'lg:w-[290px]' : 'lg:w-[72px]'}`}
      >
        <div className="flex items-center gap-1 px-3 lg:px-4 pt-3 lg:pt-4 pb-2">
          <button
            type="button"
            onClick={mobileOpen ? onCloseMobile : onToggleExpanded}
            className={iconBtn}
            aria-label={mobileOpen ? 'Cerrar menú' : full ? 'Contraer menú' : 'Expandir menú'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {mobileOpen && (
            <span className="lg:hidden ml-1 flex items-center gap-2 text-lg font-medium tracking-tight text-zinc-100">
              <AtlasLogo className="w-5 h-5" /> Atlas
            </span>
          )}
        </div>

        <div className="px-3 lg:px-4">
          <button type="button" onClick={onNew} className={`${rowBtn} text-zinc-200`} title="Nuevo chat">
            <SquarePen className="w-5 h-5 shrink-0" />
            {full && <span>Nuevo chat</span>}
          </button>
        </div>

        {full ? (
          <div className="flex-1 min-h-0 max-lg:[@media(max-height:520px)]:min-h-fit flex flex-col mt-3 lg:mt-4">
            <div className="px-3 lg:px-4 pb-2">
              <label className="flex items-center gap-2 h-10 lg:h-9 pointer-coarse:h-10 px-3 rounded-full bg-white/[0.04] focus-within:bg-white/[0.07] transition">
                <Search className="w-4 h-4 text-zinc-500 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar chats"
                  aria-label="Buscar chats"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Borrar búsqueda"
                    className="-mr-1.5 w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain max-lg:[@media(max-height:520px)]:overflow-visible px-2 lg:px-3 pb-4">
              {loading && tasks.length === 0 ? (
                <div className="space-y-2 px-2 pt-3">
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="h-7 rounded-lg bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <p className="px-3 pt-4 text-xs text-zinc-500">
                  {query ? 'No hay chats que coincidan.' : 'Tus chats aparecerán aquí.'}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mt-3">
                    <div className="px-3 pb-1.5 text-xs font-medium text-zinc-500">{group.label}</div>
                    {group.items.map((t) => (
                      <ChatItem
                        key={t.id}
                        task={t}
                        selected={selectedId === t.id}
                        onSelect={onSelect}
                        onRename={onRename}
                        onRequestDelete={onRequestDelete}
                      />
                    ))}
                  </div>
                ))
              )}
            </nav>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="px-3 lg:px-4 pt-2 pb-3 lg:pb-4 space-y-1 border-t border-white/[0.04]">
          <button type="button" onClick={onOpenConnectors} className={`${rowBtn} text-zinc-300`} title="Conectores">
            <span className="relative shrink-0">
              <Plug className="w-5 h-5" />
              <span
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#1b1c1d] ${
                  ghConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </span>
            {full && <span>Conectores</span>}
          </button>

          <div ref={userMenu.ref} className="relative">
            <button
              type="button"
              onClick={() => userMenu.setOpen(!userMenu.open)}
              className={`h-11 rounded-full flex items-center gap-3 text-sm hover:bg-white/[0.08] transition ${
                full ? 'w-full px-1.5' : 'w-10 justify-center'
              }`}
              title={fullName ? `${fullName} · ${email}` : email}
              aria-label="Cuenta"
              aria-haspopup="menu"
              aria-expanded={userMenu.open}
            >
              <UserAvatar email={email} name={fullName} avatarUrl={avatarUrl} />
              {full && <span className="truncate text-zinc-300">{fullName || email}</span>}
            </button>

            {userMenu.open && (
              <div
                role="menu"
                className="absolute bottom-full left-0 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl p-1.5 z-50 animate-pop"
              >
                <div className="px-3 py-2 min-w-0">
                  {fullName && <div className="text-sm text-zinc-200 truncate">{fullName}</div>}
                  <div className="text-xs text-zinc-400 truncate">{email}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    userMenu.setOpen(false);
                    onOpenConnectors();
                  }}
                  className="w-full flex items-center gap-3 px-3 h-10 pointer-coarse:h-11 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Plug className="w-4 h-4" /> Conectores
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-3 h-10 pointer-coarse:h-11 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
                >
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

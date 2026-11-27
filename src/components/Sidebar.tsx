import { useMemo, useState } from 'react';
import { LogOut, Menu, Plug, Search, SquarePen, X } from 'lucide-react';
import { groupTasksByDate } from '../lib/format';
import { usePopover } from '../hooks/usePopover';
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
  onNew: () => void;
  email: string;
  ghConnected: boolean;
  onOpenConnectors: () => void;
  onSignOut: () => void;
}

function UserAvatar({ email }: { email: string }) {
  return (
    <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold text-white bg-linear-to-br from-[#4F8CFF] via-[#9B72F2] to-[#E8836B]">
      {(email.charAt(0) || '?').toUpperCase()}
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

export function Sidebar({
  expanded,
  onToggleExpanded,
  mobileOpen,
  onCloseMobile,
  tasks,
  loading,
  selectedId,
  onSelect,
  onNew,
  email,
  ghConnected,
  onOpenConnectors,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState('');
  const userMenu = usePopover();
  const full = expanded || mobileOpen;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? tasks.filter((t) => t.prompt.toLowerCase().includes(q)) : tasks;
    return groupTasksByDate(list);
  }, [tasks, query]);

  const iconBtn =
    'w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 hover:bg-white/[0.08] transition shrink-0';

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden animate-fade" onClick={onCloseMobile} />
      )}

      <aside
        className={`bg-[#1b1c1d] flex flex-col h-full z-40 transition-[width] duration-200 ease-out
          ${mobileOpen ? 'fixed inset-y-0 left-0 w-[290px] shadow-2xl' : 'hidden'}
          lg:flex lg:static lg:shadow-none ${expanded ? 'lg:w-[290px]' : 'lg:w-[72px]'}`}
      >
        <div className="flex items-center gap-1 px-4 pt-4 pb-2">
          <button
            onClick={mobileOpen ? onCloseMobile : onToggleExpanded}
            className={iconBtn}
            aria-label={full ? 'Contraer menú' : 'Expandir menú'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <div className="px-4">
          <button
            onClick={onNew}
            className={`h-10 rounded-full flex items-center gap-3 text-sm text-zinc-200 hover:bg-white/[0.08] transition ${
              full ? 'w-full px-2.5' : 'w-10 justify-center'
            }`}
            title="Nueva tarea"
          >
            <SquarePen className="w-5 h-5 shrink-0" />
            {full && <span>Nueva tarea</span>}
          </button>
        </div>

        {full ? (
          <div className="flex-1 min-h-0 flex flex-col mt-4">
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 h-9 px-3 rounded-full bg-white/[0.04] focus-within:bg-white/[0.07]">
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar tareas"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 pb-4 thin-scroll">
              {loading && tasks.length === 0 ? (
                <div className="space-y-2 px-2 pt-3">
                  {[0, 1, 2, 3].map((n) => (
                    <div key={n} className="h-7 rounded-lg bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <p className="px-3 pt-4 text-xs text-zinc-500">
                  {query ? 'No hay tareas que coincidan.' : 'Tus tareas aparecerán aquí.'}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mt-3">
                    <div className="px-3 pb-1.5 text-xs font-medium text-zinc-500">{group.label}</div>
                    {group.items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        title={t.prompt}
                        className={`w-full h-9 px-3 rounded-full flex items-center gap-2 text-left text-sm transition ${
                          selectedId === t.id
                            ? 'bg-[#1f3760] text-[#d3e3fd]'
                            : 'text-zinc-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="flex-1 truncate">{t.prompt}</span>
                        <StatusDot status={t.status} />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </nav>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="p-4 pt-2 space-y-1 border-t border-white/[0.04]">
          <button
            onClick={onOpenConnectors}
            className={`h-10 rounded-full flex items-center gap-3 text-sm text-zinc-300 hover:bg-white/[0.08] transition ${
              full ? 'w-full px-2.5' : 'w-10 justify-center'
            }`}
            title="Conectores"
          >
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
              onClick={() => userMenu.setOpen(!userMenu.open)}
              className={`h-11 rounded-full flex items-center gap-3 text-sm hover:bg-white/[0.08] transition ${
                full ? 'w-full px-1.5' : 'w-10 justify-center'
              }`}
              title={email}
            >
              <UserAvatar email={email} />
              {full && <span className="truncate text-zinc-300">{email}</span>}
            </button>

            {userMenu.open && (
              <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl bg-[#28292a] border border-white/10 shadow-2xl p-1.5 z-50 animate-pop">
                <div className="px-3 py-2 text-xs text-zinc-400 truncate">{email}</div>
                <button
                  onClick={() => {
                    userMenu.setOpen(false);
                    onOpenConnectors();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Plug className="w-4 h-4" /> Conectores
                </button>
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-zinc-200 hover:bg-white/[0.06]"
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

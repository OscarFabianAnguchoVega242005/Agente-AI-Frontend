import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { describeStep } from '../lib/tools';
import type { AgentStep } from '../types';

function StepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false);
  const view = describeStep(step);
  const Icon = view.icon;

  return (
    <li className="relative pl-8">
      <span
        className={`absolute left-0 top-[7px] w-[22px] h-[22px] rounded-full flex items-center justify-center bg-[#1b1c1d] border ${
          view.failed ? 'border-red-500/40 text-red-300' : 'border-white/10 text-zinc-400'
        }`}
      >
        <Icon className="w-3 h-3" />
      </span>
      <div className="flex items-start gap-x-2 flex-wrap py-0.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={`min-h-8 py-1 text-sm leading-6 text-left hover:text-zinc-100 transition flex items-start gap-1 min-w-0 max-w-full ${
            view.failed ? 'text-red-300' : 'text-zinc-400'
          }`}
        >
          <span className="line-clamp-2 [overflow-wrap:anywhere]">
            {view.label}
            {view.failed && <span className="text-xs"> · error</span>}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 mt-[5px] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        {view.link && (
          <a
            href={view.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-8 py-1 text-xs leading-6 text-[#8ab4f8] hover:underline flex items-center gap-1 shrink-0"
          >
            {view.link.text} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {open && (
        <div className="mb-2 rounded-xl bg-[#0d0d0e] border border-white/5 text-xs font-mono overflow-hidden">
          <div className="px-3 py-2 text-zinc-500 border-b border-white/5">entrada</div>
          <pre className="px-3 py-2 text-zinc-300 overflow-x-auto max-h-40 overscroll-contain">
            {JSON.stringify(step.tool_input ?? {}, null, 2)}
          </pre>
          <div className="px-3 py-2 text-zinc-500 border-y border-white/5">salida</div>
          <pre className="px-3 py-2 text-zinc-300 overflow-x-auto max-h-56 overscroll-contain whitespace-pre-wrap break-all">
            {(step.tool_output ?? '').slice(0, 3000)}
            {(step.tool_output?.length ?? 0) > 3000 ? '\n…' : ''}
          </pre>
        </div>
      )}
    </li>
  );
}

/**
 * Traza de herramientas de una respuesta. `leading` se muestra en la misma fila que el botón
 * (en móvil, el logo de Atlas va aquí para no gastar un margen lateral).
 */
export function ToolTrace({ steps, running, leading }: { steps: AgentStep[]; running: boolean; leading?: ReactNode }) {
  const [open, setOpen] = useState(running);

  useEffect(() => {
    setOpen(running);
  }, [running]);

  if (steps.length === 0 && !running) return null;

  return (
    <div className="mb-3 @xl:mb-4">
      <div className="flex items-center gap-1.5">
        {leading}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="h-8 px-2 @xl:-ml-2 rounded-full flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition"
        >
          {running ? (
            <span className="shimmer-text font-medium">Pensando…</span>
          ) : (
            <span>
              Usó {steps.length} herramienta{steps.length === 1 ? '' : 's'}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {open && steps.length > 0 && (
        <ol className="relative mt-2 before:absolute before:left-[10.5px] before:top-3 before:bottom-3 before:w-px before:bg-white/10">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </ol>
      )}
    </div>
  );
}

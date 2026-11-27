import { useEffect, useRef, useState } from 'react';
import { Check, Copy, FolderGit2, TriangleAlert } from 'lucide-react';
import { AtlasLogo } from './AtlasLogo';
import { Markdown } from './Markdown';
import { ToolTrace } from './ToolTrace';
import { modeMeta } from '../lib/modes';
import { isFinished, type AgentMode, type AgentStep, type TaskDetail } from '../types';

/** Un turno visible: mensaje del usuario + respuesta (task es null mientras se envía). */
export interface ChatTurn {
  key: string;
  prompt: string;
  mode: AgentMode;
  targetRepo: string | null;
  task: TaskDetail | null;
  steps: AgentStep[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      title="Copiar respuesta"
      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Turn({ turn, showMeta }: { turn: ChatTurn; showMeta: boolean }) {
  const { prompt, mode, targetRepo, task, steps } = turn;
  const running = !task || !isFinished(task.status);
  const meta = modeMeta(mode);
  const ModeIcon = meta.icon;

  return (
    <div className="space-y-8">
      {/* Mensaje del usuario */}
      <div className="flex flex-col items-end gap-2 animate-rise">
        <div className="max-w-[85%] rounded-3xl rounded-tr-lg bg-[#2a2b2d] px-5 py-3 text-[15px] leading-7 text-zinc-100 whitespace-pre-wrap break-words">
          {prompt}
        </div>
        {showMeta && (
          <div className="flex items-center gap-3 text-xs text-zinc-500 pr-2">
            <span className="flex items-center gap-1">
              <ModeIcon className="w-3.5 h-3.5" /> {meta.label}
            </span>
            {targetRepo && (
              <span className="flex items-center gap-1 font-mono">
                <FolderGit2 className="w-3.5 h-3.5" /> {targetRepo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Respuesta del agente */}
      <div className="flex gap-4 animate-rise">
        <div className="pt-0.5 shrink-0">
          <AtlasLogo className="w-7 h-7" thinking={running} />
        </div>
        <div className="flex-1 min-w-0">
          <ToolTrace steps={steps} running={running} />

          {running && steps.length === 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="h-3 rounded-full shimmer-bar w-[85%]" />
              <div className="h-3 rounded-full shimmer-bar w-[65%]" />
              <div className="h-3 rounded-full shimmer-bar w-[40%]" />
            </div>
          )}

          {task?.status === 'completed' && (
            <>
              <Markdown>{task.final_response ?? 'Tarea completada sin salida de texto.'}</Markdown>
              <div className="mt-3 -ml-2 flex items-center">
                <CopyButton text={task.final_response ?? ''} />
              </div>
            </>
          )}

          {task?.status === 'failed' && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 flex gap-3">
              <TriangleAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-200">La tarea no pudo completarse</p>
                <p className="text-sm text-red-200/70 mt-1 break-words">{task.error_message ?? 'Error desconocido'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatView({ turns }: { turns: ChatTurn[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, last?.steps.length, last?.task?.status]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-10">
      {turns.map((turn, i) => {
        const prev = turns[i - 1];
        // Solo muestra modo/repo cuando cambian respecto al turno anterior
        const showMeta = !prev || prev.mode !== turn.mode || prev.targetRepo !== turn.targetRepo;
        return <Turn key={turn.key} turn={turn} showMeta={showMeta} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}

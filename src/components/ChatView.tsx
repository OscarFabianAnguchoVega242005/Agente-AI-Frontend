import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, FolderDown, FolderGit2, TriangleAlert } from 'lucide-react';
import { downloadZip, extractFiles, isHtmlFile, type CodeFile } from '../lib/files';
import { AtlasLogo } from './AtlasLogo';
import { Markdown, PreviewContext } from './Markdown';
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

const actionBtn =
  'h-9 px-3 rounded-full flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-white/[0.06] transition';

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
      aria-label={copied ? 'Respuesta copiada' : 'Copiar respuesta'}
      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Turn({
  turn,
  showMeta,
  onPreview,
}: {
  turn: ChatTurn;
  showMeta: boolean;
  onPreview?: (files: CodeFile[], entry?: string) => void;
}) {
  const { prompt, mode, targetRepo, task, steps } = turn;
  const running = !task || !isFinished(task.status);
  const meta = modeMeta(mode);
  const ModeIcon = meta.icon;
  const files = useMemo(
    () => (task?.status === 'completed' ? extractFiles(task.final_response ?? '') : []),
    [task?.status, task?.final_response]
  );
  const hasHtml = files.some(isHtmlFile);
  const previewFromBlock = useMemo(
    () => (hasHtml && onPreview ? (entry?: string) => onPreview(files, entry) : null),
    [hasHtml, onPreview, files]
  );
  const hasTrace = steps.length > 0 || running;
  // En pantallas estrechas el logo va encima de la respuesta (en la fila de la traza) y el texto usa todo el ancho
  const inlineLogo = <AtlasLogo className="w-6 h-6 shrink-0 @xl:hidden" thinking={running} />;

  return (
    <div className="space-y-5 @xl:space-y-8">
      {/* Mensaje del usuario */}
      <div className="flex flex-col items-end gap-1.5 animate-rise">
        <div className="max-w-[88%] @xl:max-w-[80%] rounded-3xl rounded-tr-lg bg-[#2a2b2d] px-4 py-2.5 @xl:px-5 @xl:py-3 text-[15px] leading-7 text-zinc-100 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {prompt}
        </div>
        {showMeta && (
          <div className="max-w-full flex items-center justify-end gap-3 text-xs text-zinc-500 pr-2">
            <span className="flex items-center gap-1 shrink-0">
              <ModeIcon className="w-3.5 h-3.5" /> {meta.label}
            </span>
            {targetRepo && (
              <span className="flex items-center gap-1 font-mono min-w-0" title={targetRepo}>
                <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{targetRepo}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Respuesta del agente */}
      <div className="flex gap-4 animate-rise">
        <div className="hidden @xl:block pt-0.5 shrink-0">
          <AtlasLogo className="w-7 h-7" thinking={running} />
        </div>
        <div className="flex-1 min-w-0">
          <ToolTrace steps={steps} running={running} leading={inlineLogo} />
          {!hasTrace && <div className="mb-2 @xl:hidden">{inlineLogo}</div>}

          {running && steps.length === 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="h-3 rounded-full shimmer-bar w-[85%]" />
              <div className="h-3 rounded-full shimmer-bar w-[65%]" />
              <div className="h-3 rounded-full shimmer-bar w-[40%]" />
            </div>
          )}

          {task?.status === 'completed' && (
            <>
              <PreviewContext.Provider value={previewFromBlock}>
                <Markdown>{task.final_response ?? 'Tarea completada sin salida de texto.'}</Markdown>
              </PreviewContext.Provider>
              <div className="mt-2 -ml-2 flex flex-wrap items-center gap-0.5">
                <CopyButton text={task.final_response ?? ''} />
                {hasHtml && onPreview && (
                  <button type="button" onClick={() => onPreview(files)} className={actionBtn}>
                    <Eye className="w-4 h-4" />
                    Vista previa
                  </button>
                )}
                {files.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => downloadZip(files)}
                    title={files.map((f) => f.path).join('\n')}
                    className={actionBtn}
                  >
                    <FolderDown className="w-4 h-4" />
                    <span className="@lg:hidden">Descargar .zip</span>
                    <span className="hidden @lg:inline">Descargar todo ({files.length} archivos, .zip)</span>
                  </button>
                )}
              </div>
            </>
          )}

          {task?.status === 'failed' && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 flex gap-3">
              <TriangleAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-200">La tarea no pudo completarse</p>
                <p className="text-sm leading-relaxed text-red-200/70 mt-1 break-words">
                  {task.error_message ?? 'Error desconocido'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatView({
  turns,
  onPreview,
}: {
  turns: ChatTurn[];
  onPreview?: (files: CodeFile[], entry?: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];

  // Desplaza solo el contenedor del chat (scrollIntoView también movería la página en iOS con el teclado abierto)
  useEffect(() => {
    const scroller = bottomRef.current?.closest('main');
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, [turns.length, last?.steps.length, last?.task?.status]);

  return (
    <div className="max-w-3xl mx-auto px-4 @xl:px-6 pt-4 @xl:pt-8 pb-6 @xl:pb-10 space-y-8 @xl:space-y-10">
      {turns.map((turn, i) => {
        const prev = turns[i - 1];
        // Solo muestra modo/repo cuando cambian respecto al turno anterior
        const showMeta = !prev || prev.mode !== turn.mode || prev.targetRepo !== turn.targetRepo;
        return <Turn key={turn.key} turn={turn} showMeta={showMeta} onPreview={onPreview} />;
      })}
      <div ref={bottomRef} />
    </div>
  );
}

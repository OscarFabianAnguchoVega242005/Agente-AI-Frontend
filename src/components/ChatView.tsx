import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  FolderDown,
  FolderGit2,
  ImageOff,
  Square,
  TriangleAlert,
  Volume2,
  X,
} from 'lucide-react';
import { ATTACHMENTS_ONLY_PROMPT, formatSize, type AttachmentView } from '../lib/attachments';
import { speak, speechSupported, stopSpeaking, useSpeaking } from '../lib/speech';
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
  /** Archivos que el usuario adjuntó a este mensaje */
  attachments: AttachmentView[];
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

/** Lee la respuesta en voz alta (síntesis de voz del navegador). */
function ListenButton({ id, text }: { id: string; text: string }) {
  const speaking = useSpeaking(id);
  if (!speechSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stopSpeaking() : speak(id, text))}
      title={speaking ? 'Detener lectura' : 'Escuchar respuesta'}
      aria-label={speaking ? 'Detener lectura' : 'Escuchar respuesta'}
      aria-pressed={speaking}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
        speaking ? 'text-[#8ab4f8] bg-[#8ab4f8]/10' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'
      }`}
    >
      {speaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}

/**
 * Imagen a pantalla completa. Va en un portal sobre <body>: la columna del chat es un contenedor CSS
 * (@container) y un `fixed` dentro de ella solo cubriría la columna, no toda la pantalla.
 */
function ImageViewer({ image, onClose }: { image: AttachmentView; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col animate-fade pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onClick={onClose}
    >
      <div className="shrink-0 h-14 flex items-center gap-2 px-3 text-sm text-zinc-200" onClick={(e) => e.stopPropagation()}>
        <span className="flex-1 min-w-0 truncate pl-1">{image.name}</span>
        {image.url && (
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 rounded-full flex items-center gap-1.5 text-xs text-zinc-200 hover:bg-white/10"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir original
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
        {image.url && (
          <img
            src={image.url}
            alt={image.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/** Archivos que el usuario adjuntó a su mensaje (miniaturas y tarjetas). */
function TurnAttachments({ attachments }: { attachments: AttachmentView[] }) {
  const [viewing, setViewing] = useState<AttachmentView | null>(null);
  const images = attachments.filter((a) => a.kind === 'image');
  const files = attachments.filter((a) => a.kind !== 'image');
  // Una sola imagen se muestra más grande
  const thumb = images.length === 1 ? 'w-48 h-48 @md:w-60 @md:h-60' : 'w-24 h-24 @md:w-32 @md:h-32';

  return (
    <div className="max-w-[88%] @xl:max-w-[80%] flex flex-col items-end gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {images.map((img, i) =>
            img.url ? (
              <button
                key={`${img.name}-${i}`}
                type="button"
                onClick={() => setViewing(img)}
                title={img.name}
                aria-label={`Ver imagen ${img.name}`}
                className={`${thumb} rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] hover:opacity-90 transition`}
              >
                <img src={img.url} alt={img.name} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ) : (
              <span
                key={`${img.name}-${i}`}
                title={img.name}
                className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-zinc-500 text-[11px] px-2 text-center"
              >
                <ImageOff className="w-5 h-5" />
                <span className="max-w-full truncate">{img.name}</span>
              </span>
            )
          )}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {files.map((f, i) => {
            const Icon = f.kind === 'pdf' ? FileText : FileCode2;
            const body = (
              <>
                <span
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    f.kind === 'pdf' ? 'bg-red-400/15 text-red-300' : 'bg-[#8ab4f8]/15 text-[#8ab4f8]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] leading-5 text-zinc-100 truncate">{f.name}</span>
                  <span className="block text-[11px] leading-4 text-zinc-500">
                    {f.kind === 'pdf' ? 'PDF' : 'Texto'} · {formatSize(f.size)}
                  </span>
                </span>
              </>
            );
            const cls = 'h-16 max-w-[16rem] rounded-2xl bg-[#2a2b2d] border border-white/[0.06] pl-3 pr-4 flex items-center gap-3';
            return f.url ? (
              <a
                key={`${f.name}-${i}`}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Abrir ${f.name}`}
                className={`${cls} hover:bg-[#333436] transition`}
              >
                {body}
              </a>
            ) : (
              <span key={`${f.name}-${i}`} title={f.name} className={cls}>
                {body}
              </span>
            );
          })}
        </div>
      )}
      {viewing && <ImageViewer image={viewing} onClose={() => setViewing(null)} />}
    </div>
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
  const { prompt, mode, targetRepo, task, steps, attachments } = turn;
  // Si solo se enviaron archivos, no se muestra el texto genérico que guarda el servidor
  const showPrompt = prompt.trim() !== '' && !(attachments.length > 0 && prompt === ATTACHMENTS_ONLY_PROMPT);
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
        {attachments.length > 0 && <TurnAttachments attachments={attachments} />}
        {showPrompt && (
          <div className="max-w-[88%] @xl:max-w-[80%] rounded-3xl rounded-tr-lg bg-[#2a2b2d] px-4 py-2.5 @xl:px-5 @xl:py-3 text-[15px] leading-7 text-zinc-100 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {prompt}
          </div>
        )}
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
                <ListenButton id={task.id} text={task.final_response ?? ''} />
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

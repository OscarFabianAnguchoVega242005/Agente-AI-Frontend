import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Download, Eye, FolderDown, Monitor, RotateCw, Smartphone, Tablet, X } from 'lucide-react';
import { Markdown } from './Markdown';
import {
  buildPreviewDocument,
  downloadFile,
  downloadZip,
  isHtmlFile,
  PREVIEW_NAVIGATE_MESSAGE,
  resolveRelative,
  type CodeFile,
} from '../lib/files';

export interface PreviewState {
  files: CodeFile[];
  entry: string;
}

type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

interface Props {
  preview: PreviewState;
  onClose: () => void;
  onChangeEntry: (entry: string) => void;
}

/**
 * Vista previa de lo que construyó Atlas.
 * El código se ejecuta en un iframe con sandbox SIN allow-same-origin: corre en un origen opaco,
 * así que no puede leer la sesión de Atlas (localStorage, cookies) ni el DOM de la app.
 */
export function PreviewPanel({ preview, onClose, onChangeEntry }: Props) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [reloadKey, setReloadKey] = useState(0);
  const [codeFile, setCodeFile] = useState(preview.entry);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const htmlFiles = useMemo(() => preview.files.filter(isHtmlFile), [preview.files]);
  const doc = useMemo(() => buildPreviewDocument(preview.files, preview.entry), [preview]);
  const shownCode = preview.files.find((f) => f.path === codeFile) ?? preview.files[0];

  useEffect(() => {
    setCodeFile(preview.entry);
  }, [preview.entry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Enlaces entre páginas del proyecto (p. ej. "nosotros.html") dentro de la vista previa
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Solo se aceptan mensajes del iframe de la vista previa
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      const data = e.data as { type?: unknown; href?: unknown };
      if (data?.type !== PREVIEW_NAVIGATE_MESSAGE || typeof data.href !== 'string') return;
      const target = resolveRelative(preview.entry, data.href);
      if (target && htmlFiles.some((f) => f.path === target)) {
        setTab('preview');
        onChangeEntry(target);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [preview.entry, htmlFiles, onChangeEntry]);

  const btn = (active: boolean) =>
    `h-8 px-2.5 rounded-full flex items-center gap-1.5 text-xs transition ${
      active ? 'bg-white/10 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]'
    }`;

  return (
    <section
      aria-label="Vista previa"
      className="fixed inset-0 z-50 flex flex-col bg-[#131314] lg:static lg:z-auto lg:w-[48%] lg:min-w-[420px] lg:border-l lg:border-white/[0.06] animate-fade"
    >
      {/* Barra superior */}
      <div className="h-16 shrink-0 flex items-center gap-2 px-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04]">
          <button type="button" onClick={() => setTab('preview')} className={btn(tab === 'preview')}>
            <Eye className="w-3.5 h-3.5" /> Vista previa
          </button>
          <button type="button" onClick={() => setTab('code')} className={btn(tab === 'code')}>
            <Code2 className="w-3.5 h-3.5" /> Código
          </button>
        </div>

        {tab === 'preview' && (
          <div className="hidden sm:flex items-center gap-0.5 ml-1">
            {(
              [
                ['desktop', Monitor, 'Escritorio'],
                ['tablet', Tablet, 'Tablet'],
                ['mobile', Smartphone, 'Móvil'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setDevice(id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  device === id ? 'bg-white/10 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
            <button
              type="button"
              title="Recargar"
              aria-label="Recargar"
              onClick={() => setReloadKey((k) => k + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {preview.files.length > 1 && (
            <button
              type="button"
              title="Descargar todo (.zip)"
              onClick={() => downloadZip(preview.files)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
            >
              <FolderDown className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Selector de página o archivo */}
      {(tab === 'preview' ? htmlFiles.length > 1 : preview.files.length > 1) && (
        <div className="shrink-0 flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/[0.06]">
          {(tab === 'preview' ? htmlFiles : preview.files).map((f) => {
            const active = tab === 'preview' ? f.path === preview.entry : f.path === shownCode?.path;
            return (
              <button
                key={f.path}
                type="button"
                onClick={() => (tab === 'preview' ? onChangeEntry(f.path) : setCodeFile(f.path))}
                className={`shrink-0 h-7 px-3 rounded-full text-xs font-mono transition ${
                  active ? 'bg-[#1f3760] text-[#d3e3fd]' : 'text-zinc-400 hover:bg-white/[0.06]'
                }`}
              >
                {f.path}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'preview' ? (
          <div className="h-full w-full flex justify-center bg-[#0d0d0e] p-0 sm:p-3">
            <iframe
              ref={iframeRef}
              key={`${preview.entry}-${reloadKey}`}
              title="Vista previa de la página"
              srcDoc={doc}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="h-full bg-white sm:rounded-lg shadow-2xl transition-[width] duration-200"
              style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}
            />
          </div>
        ) : shownCode ? (
          <div className="p-4">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => downloadFile(shownCode.path, shownCode.content)}
                className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
              >
                <Download className="w-3.5 h-3.5" /> Descargar {shownCode.path.split('/').pop()}
              </button>
            </div>
            <Markdown>{`\`\`\`\`${shownCode.language}:${shownCode.path}\n${shownCode.content}\n\`\`\`\``}</Markdown>
          </div>
        ) : null}
      </div>
    </section>
  );
}

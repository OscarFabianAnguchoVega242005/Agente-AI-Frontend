import { createContext, useContext, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download, Eye, FileCode2 } from 'lucide-react';
import { downloadFile, parseCodeInfo } from '../lib/files';

const codeBtn =
  'h-8 min-w-8 px-2 rounded-lg flex items-center justify-center gap-1.5 hover:text-zinc-100 hover:bg-white/[0.06] transition';

/** Abre la vista previa de la respuesta actual (lo provee cada turno del chat que trae HTML). */
export const PreviewContext = createContext<((entry?: string) => void) | null>(null);

function CodeBlock({ language, path, code }: { language: string; path?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const openPreview = useContext(PreviewContext);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isHtml = language.toLowerCase() === 'html' || /\.html?$/i.test(path ?? '');

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-[#0d0d0e] overflow-hidden">
      <div className="flex items-center justify-between gap-2 pl-3 @md:pl-4 pr-1 py-1 bg-white/[0.03] border-b border-white/5 text-xs text-zinc-400">
        <span className="font-mono truncate min-w-0" title={path}>
          {path ? (
            <>
              <FileCode2 className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-zinc-500" />
              <span className="text-zinc-200">{path}</span>
              {language && <span className="text-zinc-500"> · {language}</span>}
            </>
          ) : (
            language || 'código'
          )}
        </span>
        {/* En pantallas estrechas los botones son solo icono (con etiqueta accesible) */}
        <span className="flex items-center shrink-0">
          {openPreview && isHtml && (
            <button
              type="button"
              onClick={() => openPreview(path)}
              aria-label="Vista previa"
              title="Vista previa"
              className={`${codeBtn} text-[#8ab4f8] hover:text-[#aecbfa]`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden @md:inline">Vista previa</span>
            </button>
          )}
          {path && (
            <button
              type="button"
              onClick={() => downloadFile(path, code)}
              aria-label={`Descargar ${path}`}
              title="Descargar"
              className={codeBtn}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden @md:inline">Descargar</span>
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copiado' : 'Copiar código'}
            title="Copiar"
            className={codeBtn}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden @md:inline">{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </span>
      </div>
      <pre className="p-3 @md:p-4 overflow-x-auto overscroll-x-contain text-[12.5px] @md:text-[13px] leading-relaxed font-mono text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return '';
}

const components: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = textOf(children);
    // El encabezado puede ser "lenguaje" o "lenguaje:ruta/archivo" (```html:index.html)
    const match = /language-(\S+)/.exec(className ?? '');
    if (match || text.includes('\n')) {
      const { language, path } = parseCodeInfo(match?.[1] ?? '');
      return <CodeBlock language={language} path={path} code={text.replace(/\n$/, '')} />;
    }
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-white/[0.08] text-[0.88em] font-mono text-zinc-100">
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#8ab4f8] underline underline-offset-2 decoration-[#8ab4f8]/40 hover:decoration-[#8ab4f8] [overflow-wrap:anywhere]"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="text-xl font-semibold mt-6 mb-3 text-zinc-50">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-6 mb-3 text-zinc-50">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-5 mb-2 text-zinc-50">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold mt-4 mb-2 text-zinc-100">{children}</h4>,
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="my-3 pl-5 @md:pl-6 list-disc space-y-1.5 marker:text-zinc-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 pl-5 @md:pl-6 list-decimal space-y-1.5 marker:text-zinc-500">{children}</ol>,
  li: ({ children }) => <li className="leading-7 pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-[#9B72F2]/60 pl-4 text-zinc-300">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto overscroll-x-contain rounded-xl border border-white/10">
      <table className="w-full text-sm border-collapse [&_tr:last-child>td]:border-b-0">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left align-bottom font-semibold px-3 @md:px-4 py-2.5 border-b border-white/10 text-zinc-100">
      {children}
    </th>
  ),
  // Ancho mínimo por columna: en móvil la tabla se desplaza en horizontal en vez de aplastar el texto
  td: ({ children }) => (
    <td className="px-3 @md:px-4 py-2.5 border-b border-white/5 align-top min-w-[6.5rem] break-words">
      {children}
    </td>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] text-zinc-200 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

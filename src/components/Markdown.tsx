import { createContext, useContext, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download, Eye, FileCode2 } from 'lucide-react';
import { downloadFile, parseCodeInfo } from '../lib/files';

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

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-[#0d0d0e] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white/[0.03] border-b border-white/5 text-xs text-zinc-400">
        <span className="font-mono truncate min-w-0">
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
        <span className="flex items-center gap-3 shrink-0">
          {openPreview && (language.toLowerCase() === 'html' || /\.html?$/i.test(path ?? '')) && (
            <button
              type="button"
              onClick={() => openPreview(path)}
              className="flex items-center gap-1.5 text-[#8ab4f8] hover:text-[#aecbfa] transition"
            >
              <Eye className="w-3.5 h-3.5" />
              Vista previa
            </button>
          )}
          {path && (
            <button
              type="button"
              onClick={() => downloadFile(path, code)}
              className="flex items-center gap-1.5 hover:text-zinc-100 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
          )}
          <button type="button" onClick={copy} className="flex items-center gap-1.5 hover:text-zinc-100 transition">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </span>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-zinc-200">
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
      className="text-[#8ab4f8] underline underline-offset-2 decoration-[#8ab4f8]/40 hover:decoration-[#8ab4f8]"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => <h1 className="text-xl font-semibold mt-6 mb-3 text-zinc-50">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-6 mb-3 text-zinc-50">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-5 mb-2 text-zinc-50">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold mt-4 mb-2 text-zinc-100">{children}</h4>,
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="my-3 pl-6 list-disc space-y-1.5 marker:text-zinc-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 pl-6 list-decimal space-y-1.5 marker:text-zinc-500">{children}</ol>,
  li: ({ children }) => <li className="leading-7 pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-[#9B72F2]/60 pl-4 text-zinc-300">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left font-semibold px-4 py-2.5 border-b border-white/10 text-zinc-100">{children}</th>
  ),
  td: ({ children }) => <td className="px-4 py-2.5 border-b border-white/5 align-top">{children}</td>,
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

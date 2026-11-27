import { strToU8, zipSync } from 'fflate';

export interface CodeFile {
  path: string;
  language: string;
  content: string;
}

/**
 * Interpreta el encabezado de un bloque de código: "html:index.html" → { language: 'html', path: 'index.html' }.
 * Sin ruta devuelve solo el lenguaje.
 */
export function parseCodeInfo(info: string): { language: string; path?: string } {
  const trimmed = info.trim();
  const idx = trimmed.indexOf(':');
  if (idx === -1) return { language: trimmed };
  const language = trimmed.slice(0, idx);
  const path = safePath(trimmed.slice(idx + 1));
  return path ? { language, path } : { language };
}

/** Ruta relativa segura para el zip/descarga (sin "..", sin rutas absolutas). */
function safePath(raw: string): string | undefined {
  const clean = raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
  return clean && /^[\w.\-/ ()@+]+$/.test(clean) ? clean.slice(0, 200) : undefined;
}

/** Extrae los archivos con nombre (```lenguaje:ruta) de una respuesta en Markdown. */
export function extractFiles(markdown: string): CodeFile[] {
  const files = new Map<string, CodeFile>();
  const re = /^```([^\n`]*)\n([\s\S]*?)^```/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const { language, path } = parseCodeInfo(m[1] ?? '');
    if (path) files.set(path, { path, language, content: m[2] ?? '' });
  }
  return [...files.values()];
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(path: string, content: string): void {
  const name = path.split('/').pop() || 'archivo.txt';
  triggerDownload(new Blob([content], { type: 'text/plain;charset=utf-8' }), name);
}

export function downloadZip(files: CodeFile[], zipName = 'atlas-archivos.zip'): void {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.path] = strToU8(f.content);
  const data = zipSync(entries, { level: 6 });
  triggerDownload(new Blob([data], { type: 'application/zip' }), zipName);
}

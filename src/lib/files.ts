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

// ───────────────────────────── Vista previa ─────────────────────────────

export function isHtmlFile(f: CodeFile): boolean {
  return /\.html?$/i.test(f.path) || f.language.toLowerCase() === 'html';
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i + 1);
}

/** Resuelve una ruta relativa (href/src) respecto al HTML de entrada. */
function resolveRelative(fromHtml: string, ref: string): string | null {
  if (/^(?:[a-z]+:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) return null; // externa
  const clean = ref.split(/[?#]/)[0] ?? '';
  const parts = (clean.startsWith('/') ? clean.slice(1) : dirname(fromHtml) + clean).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

/**
 * Construye un documento HTML autocontenido para la vista previa:
 * incrusta los CSS y JS locales enlazados desde la página de entrada.
 */
export function buildPreviewDocument(files: CodeFile[], entryPath: string): string {
  const entry = files.find((f) => f.path === entryPath);
  if (!entry) return '';
  const byPath = new Map(files.map((f) => [f.path, f]));
  let html = entry.content;

  // <link rel="stylesheet" href="styles.css"> → <style>…</style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const file = href ? byPath.get(resolveRelative(entry.path, href) ?? '') : undefined;
    return file ? `<style>\n${file.content.replace(/<\/style/gi, '<\\/style')}\n</style>` : tag;
  });

  // <script src="app.js"></script> → <script>…</script> (conserva type="module", etc.)
  html = html.replace(
    /<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const file = byPath.get(resolveRelative(entry.path, src) ?? '');
      return file ? `<script${before}${after}>\n${file.content.replace(/<\/script/gi, '<\\/script')}\n</script>` : tag;
    }
  );

  // Fragmentos sin <html>: se envuelven en un documento mínimo
  if (!/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
  }
  return html;
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

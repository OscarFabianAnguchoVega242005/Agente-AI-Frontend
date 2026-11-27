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

/** Nombre por defecto para bloques web sin ruta (el modelo no siempre usa ```lenguaje:ruta). */
const DEFAULT_NAMES: Record<string, string> = {
  html: 'index.html',
  htm: 'index.html',
  css: 'styles.css',
  js: 'script.js',
  javascript: 'script.js',
  svg: 'image.svg',
};

function uniquePath(path: string, taken: Set<string>): string {
  if (!taken.has(path)) return path;
  const dot = path.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Extrae los archivos de una respuesta en Markdown: los bloques ```lenguaje:ruta y, además,
 * los bloques web sin nombre (html/css/js), a los que se asigna index.html, styles.css, script.js.
 * Admite vallas de 3 o más acentos graves.
 */
export function extractFiles(markdown: string): CodeFile[] {
  const files = new Map<string, CodeFile>();
  const re = /^(`{3,})([^\n`]*)\n([\s\S]*?)^\1`*[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    const info = (m[2] ?? '').trim();
    const content = m[3] ?? '';
    const parsed = parseCodeInfo(info.split(/\s+/)[0] ?? '');
    const language = parsed.language.toLowerCase();
    let path = parsed.path;

    if (!path) {
      const looksHtml = !language && /^\s*(<!doctype html|<html[\s>])/i.test(content);
      const fallback = DEFAULT_NAMES[looksHtml ? 'html' : language];
      if (!fallback) continue; // bloques de terminal, ejemplos, etc.
      path = uniquePath(fallback, new Set(files.keys()));
    }
    files.set(path, { path, language: language || (path.split('.').pop() ?? ''), content });
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
export function resolveRelative(fromHtml: string, ref: string): string | null {
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
  const cssFiles = files.filter((f) => /\.css$/i.test(f.path));
  const jsFiles = files.filter((f) => /\.(m?js)$/i.test(f.path));
  const usedCss = new Set<string>();
  const usedJs = new Set<string>();

  /** Busca por ruta; si no coincide pero solo hay un archivo de ese tipo, usa ese. */
  const find = (ref: string, pool: CodeFile[]): CodeFile | undefined => {
    const resolved = resolveRelative(entry.path, ref);
    if (resolved === null) return undefined; // externa (CDN)
    return byPath.get(resolved) ?? (pool.length === 1 ? pool[0] : undefined);
  };

  let html = entry.content;

  // <link rel="stylesheet" href="styles.css"> → <style>…</style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    const file = href ? find(href, cssFiles) : undefined;
    if (!file) return tag;
    usedCss.add(file.path);
    return `<style>\n${file.content.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  });

  // <script src="app.js"></script> → <script>…</script> (conserva type="module", etc.)
  html = html.replace(
    /<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const file = find(src, jsFiles);
      if (!file) return tag;
      usedJs.add(file.path);
      return `<script${before}${after}>\n${file.content.replace(/<\/script/gi, '<\\/script')}\n</script>`;
    }
  );

  // Si el HTML no enlaza el CSS/JS que vino en la respuesta (bloques sueltos), se añaden igualmente
  const extraCss = cssFiles.filter((f) => !usedCss.has(f.path));
  const extraJs = jsFiles.filter((f) => !usedJs.has(f.path));
  if (extraCss.length) {
    const styles = extraCss.map((f) => `<style>\n${f.content.replace(/<\/style/gi, '<\\/style')}\n</style>`).join('\n');
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${styles}\n</head>`) : styles + html;
  }
  if (extraJs.length) {
    const scripts = extraJs.map((f) => `<script>\n${f.content.replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${scripts}\n</body>`) : html + scripts;
  }

  // Fragmentos sin <html>: se envuelven en un documento mínimo
  if (!/<html[\s>]/i.test(html) && !/<body[\s>]/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
  }

  // Script de navegación: va primero para que se ejecute antes que el de la página
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (tag) => `${tag}\n${PREVIEW_NAV_SCRIPT}`)
    : PREVIEW_NAV_SCRIPT + html;
}

/** Mensaje que la vista previa envía a Atlas para abrir otra página del proyecto. */
export const PREVIEW_NAVIGATE_MESSAGE = 'atlas-preview-navigate';

/**
 * Dentro de un iframe srcdoc, los enlaces relativos se resuelven contra la URL de Atlas:
 * un "#contacto" o un formulario sin action navegarían el iframe a Atlas.
 * Este script:
 * - "#ancla": hace scroll a la sección en la misma página.
 * - Enlaces http(s) externos: los abre en una pestaña nueva.
 * - Otros enlaces relativos (otra.html): pide a Atlas que cambie de página (postMessage).
 * - Formularios sin action externa: evita que recarguen la vista previa.
 */
const PREVIEW_NAV_SCRIPT = `<script>
(function () {
  function scrollToHash(hash) {
    var id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var el = document.getElementById(id) || document.getElementsByName(id)[0];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    // Sin elemento con ese id (p. ej. routers "#/ruta"): cambia el hash del propio documento
    try { location.hash = '#' + id; } catch (err) {}
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (!a || e.defaultPrevented) return;
    var href = (a.getAttribute('href') || '').trim();
    if (/^javascript:/i.test(href)) return;
    e.preventDefault();
    if (href === '' || href.charAt(0) === '#') { scrollToHash(href); return; }
    if (/^(https?:)?\\/\\//i.test(href)) { window.open(a.href, '_blank', 'noopener,noreferrer'); return; }
    if (/^(mailto|tel|sms):/i.test(href)) return;
    var hashIndex = href.indexOf('#');
    parent.postMessage({ type: '${'atlas-preview-navigate'}', href: hashIndex === -1 ? href : href.slice(0, hashIndex) }, '*');
  }, true);
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var action = form && form.getAttribute ? (form.getAttribute('action') || '') : '';
    if (!/^https?:\\/\\//i.test(action)) e.preventDefault();
  }, true);
})();
</script>`;

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

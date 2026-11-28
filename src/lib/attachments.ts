/**
 * Archivos adjuntos en el navegador: clasificación, compresión de imágenes y lectura en base64.
 * Los límites coinciden con los del backend (que vuelve a validarlo todo).
 */

export type AttachmentKind = 'image' | 'pdf' | 'text';

/** Adjunto en el cuadro de texto, antes de enviar. */
export interface DraftAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  /** Bytes que se enviarán (tras comprimir) */
  size: number;
  /** Miniatura local (solo imágenes) */
  previewUrl?: string;
  /** Contenido en base64, sin prefijo data: */
  data?: string;
  status: 'processing' | 'ready';
}

/** Adjunto ya enviado, tal como lo muestra el chat. */
export interface AttachmentView {
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  size: number;
  url: string | null;
}

export const MAX_ATTACHMENTS = 6;
const MAX_BINARY_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_BYTES = 300 * 1024;
/** Total de imágenes y PDF por mensaje */
export const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const IMAGE_MAX_SIDE = 2048;
/** Capturas pequeñas se envían sin recomprimir (el texto se lee mejor) */
const IMAGE_KEEP_BYTES = 1.5 * 1024 * 1024;

/** Lo que el servidor guarda como mensaje cuando solo se envían archivos. */
export const ATTACHMENTS_ONLY_PROMPT = 'Revisa los archivos adjuntos.';

const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'mdx', 'csv', 'tsv', 'json', 'jsonc', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml', 'svg',
  'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'vue', 'svelte',
  'astro', 'py', 'rb', 'php', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'dart',
  'scala', 'sql', 'graphql', 'gql', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'gradle', 'properties', 'log', 'prisma',
  'proto', 'tf', 'r', 'lua', 'pl', 'ex', 'exs', 'hs', 'clj', 'vb', 'fs', 'tex', 'rst', 'conf', 'cfg', 'lock',
];
const TEXT_EXT_SET = new Set(TEXT_EXTENSIONS);
const TEXT_NAMES = /^(dockerfile|makefile|procfile|readme|license|\.gitignore|\.env(\..+)?|\.editorconfig|\.npmrc)$/i;
const TEXT_APP_TYPES = new Set(['application/json', 'application/xml', 'application/javascript', 'application/x-yaml', 'application/sql']);

/** Valor del atributo accept del selector de archivos. */
export const ACCEPT_ATTR = ['image/*', 'application/pdf', 'text/*', ...TEXT_EXTENSIONS.map((e) => `.${e}`)].join(',');

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Tipo de adjunto según el tipo MIME o la extensión; null si no se admite. */
export function classify(file: File): AttachmentKind | null {
  const type = file.type.toLowerCase();
  const ext = extension(file.name);
  if (type === 'image/svg+xml' || ext === 'svg') return 'text'; // el SVG es código: Gemini lo lee mejor como texto
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.startsWith('text/') || TEXT_APP_TYPES.has(type) || TEXT_EXT_SET.has(ext) || TEXT_NAMES.test(file.name)) return 'text';
  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Reduce y comprime la imagen (máx. 2048 px). Formatos que Gemini no admite (GIF, BMP…) se convierten. */
async function prepareImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  const type = file.type.toLowerCase();
  const native = type === 'image/png' || type === 'image/jpeg' || type === 'image/webp';
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bitmap = null;
  }
  if (!bitmap) {
    // El navegador no la decodifica (p. ej. HEIC fuera de Safari): se envía tal cual si Gemini la admite
    if (native || type === 'image/heic' || type === 'image/heif') return { blob: file, mimeType: type };
    throw new Error(`No se pudo leer la imagen "${file.name}".`);
  }

  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (native && scale === 1 && file.size <= IMAGE_KEEP_BYTES) {
    bitmap.close();
    return { blob: file, mimeType: type };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // WebP conserva la transparencia y pesa poco; si el navegador no sabe generarlo, JPEG con fondo blanco
  const webp = await canvasToBlob(canvas, 'image/webp', 0.9);
  if (webp && webp.type === 'image/webp') {
    bitmap.close();
    return { blob: webp, mimeType: 'image/webp' };
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.88);
  if (!jpeg) throw new Error(`No se pudo comprimir la imagen "${file.name}".`);
  return { blob: jpeg, mimeType: 'image/jpeg' };
}

/** Lee y prepara un archivo para enviarlo. Lanza un Error con un mensaje para el usuario si no es válido. */
export async function prepareFile(file: File, kind: AttachmentKind): Promise<{ data: string; mimeType: string; size: number }> {
  if (kind === 'image') {
    const { blob, mimeType } = await prepareImage(file);
    if (blob.size > MAX_BINARY_BYTES) throw new Error(`"${file.name}" pesa demasiado (máx. ${formatSize(MAX_BINARY_BYTES)}).`);
    return { data: await blobToBase64(blob), mimeType, size: blob.size };
  }

  if (kind === 'pdf') {
    if (file.size > MAX_BINARY_BYTES) throw new Error(`"${file.name}" pesa ${formatSize(file.size)}; el máximo es ${formatSize(MAX_BINARY_BYTES)}.`);
    const head = await file.slice(0, 5).text();
    if (head !== '%PDF-') throw new Error(`"${file.name}" no es un PDF válido.`);
    return { data: await blobToBase64(file), mimeType: 'application/pdf', size: file.size };
  }

  if (file.size > MAX_TEXT_BYTES) throw new Error(`"${file.name}" es muy largo (máx. ${formatSize(MAX_TEXT_BYTES)} de texto).`);
  const text = await file.text();
  if (text.includes('\u0000')) throw new Error(`"${file.name}" no parece un archivo de texto.`);
  const utf8 = new Blob([text], { type: 'text/plain' });
  return { data: await blobToBase64(utf8), mimeType: 'text/plain', size: utf8.size };
}

let counter = 0;
export function newAttachmentId(): string {
  counter += 1;
  return `att-${Date.now().toString(36)}-${counter}`;
}

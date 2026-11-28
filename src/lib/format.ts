import type { TaskSummary } from '../types';

/** Primer nombre a partir del nombre completo de Google ("Oscar Fabián …" → "Oscar"). */
export function firstName(fullName: string | undefined | null): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

export function displayName(email: string | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[._\-+\d]/).find((p) => p.length > 0) ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Nombre visible del chat: el título (generado o puesto por el usuario) o el primer mensaje limpio. */
export function chatTitle(task: Pick<TaskSummary, 'title' | 'prompt'>): string {
  if (task.title && task.title.trim()) return task.title.trim();
  const clean = task.prompt
    .replace(/[\r\n]+/g, ' ')
    .replace(/^[\s"'“”«»¿¡`*#>-]+|[\s"'“”«»?!.,:;`*]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Nuevo chat';
}

const DAY = 86_400_000;

export function groupTasksByDate(tasks: TaskSummary[]): Array<{ label: string; items: TaskSummary[] }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: Array<{ label: string; from: number; items: TaskSummary[] }> = [
    { label: 'Hoy', from: today, items: [] },
    { label: 'Ayer', from: today - DAY, items: [] },
    { label: 'Últimos 7 días', from: today - 7 * DAY, items: [] },
    { label: 'Últimos 30 días', from: today - 30 * DAY, items: [] },
    { label: 'Anteriores', from: -Infinity, items: [] },
  ];

  for (const task of tasks) {
    const time = new Date(task.updated_at ?? task.created_at).getTime();
    const bucket = buckets.find((b) => time >= b.from) ?? buckets[buckets.length - 1]!;
    bucket.items.push(task);
  }

  return buckets.filter((b) => b.items.length > 0).map(({ label, items }) => ({ label, items }));
}

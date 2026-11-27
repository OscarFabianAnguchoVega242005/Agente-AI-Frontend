import type { TaskSummary } from '../types';

export function displayName(email: string | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  const first = local.split(/[._\-+\d]/).find((p) => p.length > 0) ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
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
    const time = new Date(task.created_at).getTime();
    const bucket = buckets.find((b) => time >= b.from) ?? buckets[buckets.length - 1]!;
    bucket.items.push(task);
  }

  return buckets.filter((b) => b.items.length > 0).map(({ label, items }) => ({ label, items }));
}

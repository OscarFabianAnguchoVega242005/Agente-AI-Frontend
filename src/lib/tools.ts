import {
  Brain,
  FileText,
  Files,
  FolderTree,
  GitBranch,
  Hourglass,
  List,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AgentStep } from '../types';

export interface StepView {
  icon: LucideIcon;
  label: string;
  failed: boolean;
  link?: { href: string; text: string };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseJson(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function describeStep(step: AgentStep): StepView {
  const input = step.tool_input ?? {};
  const failed = (step.tool_output ?? '').startsWith('Error ejecutando');

  switch (step.tool_name) {
    case 'list_repos':
      return { icon: List, label: 'Listó tus repositorios', failed };
    case 'get_repo_tree':
      return { icon: FolderTree, label: `Exploró la estructura de ${str(input.repo) || 'el repositorio'}`, failed };
    case 'read_file':
      return { icon: FileText, label: `Leyó ${str(input.path) || 'un archivo'}`, failed };
    case 'read_files': {
      const paths = Array.isArray(input.paths) ? input.paths.map(String) : [];
      const preview = paths.slice(0, 2).join(', ');
      const label =
        paths.length === 0
          ? 'Leyó varios archivos'
          : `Leyó ${paths.length} archivo${paths.length === 1 ? '' : 's'}: ${preview}${paths.length > 2 ? '…' : ''}`;
      return { icon: Files, label, failed };
    }
    case 'commit_files_to_branch': {
      const files = Array.isArray(input.files) ? input.files.length : 0;
      const branch = str(input.newBranch);
      const repo = str(input.repo);
      const out = parseJson(step.tool_output);
      const owner = out ? str(out.owner) : '';
      return {
        icon: GitBranch,
        label: `Subió ${files} archivo${files === 1 ? '' : 's'} a ${branch || 'una rama nueva'}`,
        failed,
        link:
          owner && repo && branch && !failed
            ? {
                href: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree/${branch
                  .split('/')
                  .map(encodeURIComponent)
                  .join('/')}`,
                text: 'Ver rama',
              }
            : undefined,
      };
    }
    case 'model_fallback':
      return { icon: Zap, label: 'Cambió al modelo rápido (el modelo Pro no está disponible)', failed: false };
    case 'rate_limit_wait': {
      const seconds = typeof input.seconds === 'number' ? input.seconds : 0;
      return { icon: Hourglass, label: `Esperó ${seconds} s por el límite del plan gratuito`, failed: false };
    }
    case 'save_project_memory':
      return { icon: Brain, label: `Guardó notas del proyecto ${str(input.repo_name)}`.trim(), failed };
    default:
      return { icon: Wrench, label: `Usó ${step.tool_name}`, failed };
  }
}

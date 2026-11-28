import {
  Brain,
  FileText,
  Files,
  FlaskConical,
  FolderTree,
  GitBranch,
  GitPullRequest,
  Globe,
  History,
  Hourglass,
  KeyRound,
  List,
  Search,
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
    case 'search_code':
      return { icon: Search, label: `Buscó "${str(input.query)}" en el código`, failed };
    case 'commit_changes':
    case 'commit_files_to_branch': {
      const files = Array.isArray(input.files) ? input.files.length : 0;
      const out = parseJson(step.tool_output);
      // El backend devuelve la rama real (con prefijo agent/ forzado)
      const branch = (out && str(out.branch)) || str(input.newBranch);
      const owner = out ? str(out.owner) : '';
      const repo = (out && str(out.repo)) || str(input.repo).split('/').pop() || '';
      const compareUrl = out ? str(out.compareUrl) : '';
      return {
        icon: GitBranch,
        label: `Subió ${files} archivo${files === 1 ? '' : 's'} a ${branch || 'una rama nueva'}`,
        failed,
        link:
          !failed && compareUrl.startsWith('https://github.com/')
            ? { href: compareUrl, text: 'Ver cambios' }
            : !failed && owner && repo && branch
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
    case 'scan_secrets': {
      const out = parseJson(step.tool_output);
      const count = out && typeof out.findings_count === 'number' ? out.findings_count : null;
      const scanned = out && typeof out.files_scanned === 'number' ? out.files_scanned : null;
      const label =
        count === null
          ? 'Escaneó el repositorio en busca de credenciales'
          : count === 0
            ? `Escaneó ${scanned ?? ''} archivos: sin credenciales expuestas`
            : `Escaneó ${scanned ?? ''} archivos: ${count} posible${count === 1 ? '' : 's'} credencial${count === 1 ? '' : 'es'} expuesta${count === 1 ? '' : 's'}`;
      return { icon: KeyRound, label: label.replace(/\s+/g, ' '), failed: failed || (count ?? 0) > 0 };
    }
    case 'scan_git_history': {
      const out = parseJson(step.tool_output);
      const count = out && typeof out.findings_count === 'number' ? out.findings_count : null;
      const commits = out && typeof out.commits_scanned === 'number' ? out.commits_scanned : null;
      const onlyHistory = out && typeof out.only_in_history === 'number' ? out.only_in_history : 0;
      const label =
        count === null
          ? 'Revisó el historial de Git en busca de credenciales'
          : count === 0
            ? `Revisó ${commits ?? ''} commits del historial: sin credenciales`
            : `Revisó ${commits ?? ''} commits: ${count} credencial${count === 1 ? '' : 'es'} en el historial${onlyHistory ? ` (${onlyHistory} ya borrada${onlyHistory === 1 ? '' : 's'} del código)` : ''}`;
      return { icon: History, label: label.replace(/\s+/g, ' '), failed: failed || (count ?? 0) > 0 };
    }
    case 'run_checks': {
      const out = parseJson(step.tool_output);
      const conclusion = out ? str(out.conclusion) : '';
      const url = out ? str(out.run_url) : '';
      const commands = Array.isArray(input.commands) ? input.commands.map(String) : [];
      const what = commands.length ? `: ${commands.slice(0, 3).join(' · ')}${commands.length > 3 ? '…' : ''}` : '';
      const label =
        conclusion === 'success'
          ? `Pruebas superadas en GitHub Actions${what}`
          : conclusion === 'failure'
            ? `Pruebas fallidas en GitHub Actions${what}`
            : conclusion === 'timeout'
              ? 'Las pruebas en GitHub Actions siguen en curso'
              : conclusion === 'not_started'
                ? 'GitHub Actions no arrancó las pruebas'
                : `Ejecutó pruebas en GitHub Actions${what}`;
      return {
        icon: FlaskConical,
        label,
        failed: failed || (conclusion !== '' && conclusion !== 'success'),
        link: url.startsWith('https://github.com/') ? { href: url, text: 'Ver ejecución' } : undefined,
      };
    }
    case 'create_pull_request': {
      const out = parseJson(step.tool_output);
      const url = out ? str(out.url) : '';
      const number = out && typeof out.number === 'number' ? out.number : null;
      return {
        icon: GitPullRequest,
        label: number ? `Abrió el Pull Request #${number}` : `Abrió un Pull Request: ${str(input.title)}`,
        failed,
        link: !failed && url.startsWith('https://github.com/') ? { href: url, text: 'Ver PR' } : undefined,
      };
    }
    case 'model_fallback':
      return {
        icon: Zap,
        label: str(input.to) ? `Cambió al modelo ${str(input.to)} (${str(input.from) || 'el anterior'} sin cuota disponible)` : 'Cambió de modelo (sin cuota disponible)',
        failed: false,
      };
    case 'overload_wait': {
      const seconds = typeof input.seconds === 'number' ? input.seconds : 0;
      return { icon: Hourglass, label: `Modelo saturado: reintentando en ${seconds} s`, failed: false };
    }
    case 'rate_limit_wait': {
      const seconds = typeof input.seconds === 'number' ? input.seconds : 0;
      return { icon: Hourglass, label: `Esperó ${seconds} s por el límite del plan gratuito`, failed: false };
    }
    case 'web_search': {
      const out = parseJson(step.tool_output);
      const sources = out && Array.isArray(out.sources) ? out.sources.length : null;
      const query = str(input.query);
      const short = query.length > 80 ? `${query.slice(0, 80)}…` : query;
      return {
        icon: Globe,
        label: `Buscó en internet: "${short}"${sources ? ` (${sources} fuente${sources === 1 ? '' : 's'})` : ''}`,
        failed,
      };
    }
    case 'list_commits': {
      const out = parseJson(step.tool_output);
      const n = out && typeof out.commits_returned === 'number' ? out.commits_returned : null;
      const path = str(input.path);
      return {
        icon: History,
        label: `Revisó ${n ?? 'los'} commits${path ? ` de ${path}` : ''} y sus autores`,
        failed,
      };
    }
    case 'get_commit': {
      const out = parseJson(step.tool_output);
      const url = out ? str(out.url) : '';
      return {
        icon: GitBranch,
        label: `Revisó el commit ${str(input.sha).slice(0, 7)}`,
        failed,
        link: !failed && url.startsWith('https://github.com/') ? { href: url, text: 'Ver commit' } : undefined,
      };
    }
    case 'save_project_memory':
      return { icon: Brain, label: `Guardó notas del proyecto ${str(input.repo_name)}`.trim(), failed };
    default:
      return { icon: Wrench, label: `Usó ${step.tool_name}`, failed };
  }
}

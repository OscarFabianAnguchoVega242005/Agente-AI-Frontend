import type { AttachmentView } from './lib/attachments';

export type AgentMode = 'vibecoding' | 'appsec' | 'general' | 'gmail';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RepoItem {
  name: string;
  /** "dueño/nombre" (lo envía el backend; permite repos de organizaciones) */
  full_name?: string;
  private: boolean;
  default_branch: string;
  language?: string | null;
  description: string | null;
}

/** Identificador que se envía al agente: "dueño/nombre" si está disponible. */
export function repoId(repo: RepoItem): string {
  return repo.full_name ?? repo.name;
}

export interface GithubUser {
  account_label: string;
  avatar_url?: string | null;
}

export interface TaskSummary {
  id: string;
  prompt: string;
  mode: AgentMode;
  target_repo: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at?: string;
  /** Título del chat (generado por Atlas o puesto por el usuario) */
  title?: string | null;
}

export interface TaskDetail extends TaskSummary {
  final_response: string | null;
  error_message: string | null;
}

export interface AgentStep {
  id: string;
  step_number: number;
  tool_name: string;
  tool_input: Record<string, unknown> | null;
  tool_output: string | null;
}

/** Un turno de la conversación: el mensaje del usuario (task.prompt) y la respuesta del agente. */
export interface ConversationTurn {
  task: TaskDetail;
  steps: AgentStep[];
  /** Archivos que el usuario adjuntó a ese mensaje (con enlaces firmados temporales) */
  attachments?: AttachmentView[];
}

export interface ConnectorsResponse {
  github: {
    connected: boolean;
    oauthAvailable?: boolean;
    user?: GithubUser;
    repos: RepoItem[];
  };
}

export function isFinished(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed';
}

export type AgentMode = 'vibecoding' | 'appsec' | 'general' | 'gmail';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RepoItem {
  name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
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

export interface ConnectorsResponse {
  github: {
    connected: boolean;
    user?: GithubUser;
    repos: RepoItem[];
  };
}

export function isFinished(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed';
}

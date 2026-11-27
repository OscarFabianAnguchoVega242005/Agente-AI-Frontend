import { supabase, API_BASE_URL } from './supabase';
import type { AgentMode, ConnectorsResponse, ConversationTurn, TaskSummary } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(
      'No se pudo contactar con el servidor. Si está en Render puede estar despertando; reintenta en unos segundos.',
      0
    );
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new ApiError(body.error ?? `El servidor respondió con error ${res.status}`, res.status);
  }
  return body as T;
}

export const api = {
  getConnectors: () => request<ConnectorsResponse>('/api/connectors'),

  connectGithub: (token: string) =>
    request<{ connected: true; username: string; avatar_url: string }>('/api/connectors/github', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  githubOAuthStart: () =>
    request<{ url: string; state: string }>('/api/connectors/github/oauth/start', { method: 'POST' }),

  githubOAuthExchange: (code: string, state: string) =>
    request<{ connected: true; username: string; avatar_url: string }>('/api/connectors/github/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, state }),
    }),

  disconnect: (provider: 'github') =>
    request<{ disconnected: true }>(`/api/connectors/${provider}`, { method: 'DELETE' }),

  listTasks: () => request<{ tasks: TaskSummary[] }>('/api/tasks'),

  getConversation: (id: string) => request<{ turns: ConversationTurn[] }>(`/api/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<{ deleted: true }>(`/api/conversations/${id}`, { method: 'DELETE' }),

  createTask: (payload: { prompt: string; mode: AgentMode; targetRepo?: string; conversationId?: string }) =>
    request<{ taskId: string; conversationId: string; status: string }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

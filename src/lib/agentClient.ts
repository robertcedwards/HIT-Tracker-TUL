import { supabase } from './supabase';

export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentToolCall = { name: string; input: unknown };

export type AgentReply = {
  text: string;
  toolCalls: AgentToolCall[];
};

const ENDPOINT = '/.netlify/functions/agent-chat';

export async function sendAgentChat(
  messages: AgentMessage[],
  signal?: AbortSignal,
): Promise<AgentReply> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return {
    text: payload.text ?? '',
    toolCalls: payload.tool_calls ?? [],
  };
}

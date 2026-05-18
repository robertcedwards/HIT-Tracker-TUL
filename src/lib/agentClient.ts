import { supabase } from './supabase';

export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'done'; stop_reason: string | null; usage: unknown }
  | { type: 'error'; message: string; status?: number };

export type AgentStreamHandler = (event: AgentStreamEvent) => void;

const ENDPOINT = '/api/agent-chat';

export async function streamAgentChat(
  messages: AgentMessage[],
  onEvent: AgentStreamHandler,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    onEvent({ type: 'error', message: 'Not signed in.' });
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    onEvent({ type: 'error', message: msg, status: res.status });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      parseAndEmit(raw, onEvent);
    }
  }

  if (buffer.trim()) parseAndEmit(buffer, onEvent);
}

function parseAndEmit(raw: string, onEvent: AgentStreamHandler): void {
  let event = 'message';
  let data = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return;
  let parsed: any;
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }
  switch (event) {
    case 'text':
      onEvent({ type: 'text', delta: parsed.delta ?? '' });
      break;
    case 'tool_use':
      onEvent({ type: 'tool_use', name: parsed.name, input: parsed.input });
      break;
    case 'done':
      onEvent({ type: 'done', stop_reason: parsed.stop_reason ?? null, usage: parsed.usage });
      break;
    case 'error':
      onEvent({ type: 'error', message: parsed.message ?? 'Unknown error', status: parsed.status });
      break;
  }
}

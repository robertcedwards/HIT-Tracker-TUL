export type ChatRole = 'user' | 'assistant';

export type StoredToolCall = { name: string; input: unknown };

export type ChatThreadMeta = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type StoredChatMessage = {
  id: string;
  thread_id: string;
  role: ChatRole;
  content: string;
  tool_calls: StoredToolCall[] | null;
  created_at: string;
};

export type ChatFavorite = {
  id: string;
  prompt: string;
  created_at: string;
};

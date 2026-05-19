import { supabase } from './supabase';
import type {
  ChatFavorite,
  ChatThreadMeta,
  StoredChatMessage,
  StoredToolCall,
} from '../types/Chat';

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'New chat';
}

export async function createThread(firstUserMessage: string): Promise<ChatThreadMeta> {
  const user_id = await getUserId();
  const { data, error } = await supabase
    .from('chat_threads')
    .insert({ user_id, title: titleFromPrompt(firstUserMessage) })
    .select('id, title, created_at, updated_at')
    .single();
  if (error) throw error;
  return data as ChatThreadMeta;
}

export async function saveMessage(args: {
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: StoredToolCall[];
}): Promise<void> {
  const user_id = await getUserId();
  const { error } = await supabase.from('chat_messages').insert({
    thread_id: args.threadId,
    user_id,
    role: args.role,
    content: args.content,
    tool_calls: args.toolCalls ?? null,
  });
  if (error) throw error;
  // Bump thread updated_at so it sorts to the top of the list.
  await supabase
    .from('chat_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', args.threadId);
}

export async function listRecentThreads(limit = 15): Promise<ChatThreadMeta[]> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ChatThreadMeta[]) ?? [];
}

export async function loadThread(threadId: string): Promise<StoredChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, thread_id, role, content, tool_calls, created_at')
    .eq('thread_id', threadId)
    .order('created_at');
  if (error) throw error;
  return (data as StoredChatMessage[]) ?? [];
}

export async function deleteThread(threadId: string): Promise<void> {
  const { error } = await supabase.from('chat_threads').delete().eq('id', threadId);
  if (error) throw error;
}

export async function listFavorites(): Promise<ChatFavorite[]> {
  const { data, error } = await supabase
    .from('chat_favorites')
    .select('id, prompt, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ChatFavorite[]) ?? [];
}

export async function addFavorite(prompt: string): Promise<ChatFavorite> {
  const user_id = await getUserId();
  const clean = prompt.trim();
  if (!clean) throw new Error('Prompt is empty');
  const { data, error } = await supabase
    .from('chat_favorites')
    .upsert(
      { user_id, prompt: clean },
      { onConflict: 'user_id,prompt', ignoreDuplicates: false },
    )
    .select('id, prompt, created_at')
    .single();
  if (error) throw error;
  return data as ChatFavorite;
}

export async function removeFavorite(id: string): Promise<void> {
  const { error } = await supabase.from('chat_favorites').delete().eq('id', id);
  if (error) throw error;
}

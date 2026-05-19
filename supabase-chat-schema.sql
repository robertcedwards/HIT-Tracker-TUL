-- Chat history + favorites for Hit Flow Coach.
-- Run this in the Supabase SQL editor.

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_updated_idx
  on public.chat_threads (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at);

create table if not exists public.chat_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  created_at timestamptz not null default now(),
  unique (user_id, prompt)
);

create index if not exists chat_favorites_user_created_idx
  on public.chat_favorites (user_id, created_at desc);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_favorites enable row level security;

create policy "Users manage own chat threads"
  on public.chat_threads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own chat messages"
  on public.chat_messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own chat favorites"
  on public.chat_favorites
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

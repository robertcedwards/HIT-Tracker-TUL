import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Wrench,
  PanelLeft,
  PanelRight,
  Move,
  Plus,
  History,
  Star,
  StarOff,
  Trash2,
  Activity,
  Dumbbell,
  TrendingUp,
  BarChart3,
  Pill,
  ListChecks,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendAgentChat, AgentMessage } from '../lib/agentClient';
import {
  addFavorite,
  createThread,
  deleteThread,
  listFavorites,
  listRecentThreads,
  loadThread,
  removeFavorite,
  saveMessage,
} from '../lib/chatHistory';
import type { ChatFavorite, ChatThreadMeta, StoredToolCall } from '../types/Chat';

type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: StoredToolCall[]; pending: boolean };

type ChatMode = 'floating' | 'left' | 'right';

const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 420;
const MOBILE_BREAKPOINT = 768;

const CAPABILITIES: { tool: string; label: string; description: string; icon: React.ReactNode }[] = [
  { tool: 'list_exercises', label: 'All exercises', description: 'Lists every exercise you log with session counts.', icon: <ListChecks size={12} /> },
  { tool: 'get_recent_workouts', label: 'Recent workouts', description: 'Pulls workouts across all lifts for a date range.', icon: <Activity size={12} /> },
  { tool: 'get_exercise_history', label: 'Lift progress', description: 'Weight + TUL trend for a single exercise.', icon: <TrendingUp size={12} /> },
  { tool: 'compute_workout_stats', label: 'Workout stats', description: 'PRs, session counts, and aggregates over a window.', icon: <BarChart3 size={12} /> },
  { tool: 'list_user_supplements', label: 'My supplements', description: 'Your personal supplement list and dosages.', icon: <Pill size={12} /> },
  { tool: 'get_supplement_log', label: 'Supplement log', description: 'Recent supplement intake records.', icon: <Dumbbell size={12} /> },
];

const EXAMPLE_PROMPTS = [
  "How's my chest press progressing over the last month?",
  'What was my heaviest squat this quarter?',
  'Did I miss any supplements this week?',
  'How many workouts did I do in the last 30 days?',
  'Compare my bench and incline press progression.',
  'Which lift has improved the most recently?',
];

function loadPref<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [favorites, setFavorites] = useState<ChatFavorite[]>([]);
  const [recentThreads, setRecentThreads] = useState<ChatThreadMeta[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [mode, setMode] = useState<ChatMode>(() =>
    loadPref<ChatMode>('agentChat.mode', 'floating', (raw) =>
      raw === 'left' || raw === 'right' ? raw : 'floating',
    ),
  );
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    loadPref('agentChat.width', DEFAULT_WIDTH, (raw) => {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return DEFAULT_WIDTH;
      return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
    }),
  );
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );

  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [turns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    try {
      window.localStorage.setItem('agentChat.mode', mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('agentChat.width', String(sidebarWidth));
    } catch {
      /* ignore */
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const refreshSideData = useCallback(async () => {
    try {
      const [favs, threads] = await Promise.all([listFavorites(), listRecentThreads()]);
      setFavorites(favs);
      setRecentThreads(threads);
    } catch (err) {
      console.error('Failed to load chat side data', err);
    }
  }, []);

  useEffect(() => {
    if (open) void refreshSideData();
  }, [open, refreshSideData]);

  const effectiveMode: ChatMode = isMobile ? 'floating' : mode;

  const newChat = () => {
    setThreadId(null);
    setTurns([]);
    setShowHistory(false);
    void refreshSideData();
  };

  const openThread = async (id: string) => {
    setShowHistory(false);
    try {
      const messages = await loadThread(id);
      const loadedTurns: ChatTurn[] = messages.map((m) =>
        m.role === 'user'
          ? { role: 'user', text: m.content }
          : { role: 'assistant', text: m.content, toolCalls: m.tool_calls ?? [], pending: false },
      );
      setThreadId(id);
      setTurns(loadedTurns);
    } catch (err) {
      console.error('Failed to load thread', err);
    }
  };

  const dropThread = async (id: string) => {
    try {
      await deleteThread(id);
      if (threadId === id) newChat();
      setRecentThreads((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete thread', err);
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    setInput('');

    let activeThreadId = threadId;
    let creatingThread = false;
    if (!activeThreadId) {
      try {
        const t = await createThread(text);
        activeThreadId = t.id;
        creatingThread = true;
        setThreadId(t.id);
      } catch (err) {
        console.error('Failed to create thread', err);
      }
    }

    const nextTurns: ChatTurn[] = [
      ...turns,
      { role: 'user', text },
      { role: 'assistant', text: '', toolCalls: [], pending: true },
    ];
    setTurns(nextTurns);
    setBusy(true);

    if (activeThreadId) {
      void saveMessage({ threadId: activeThreadId, role: 'user', content: text }).catch((err) =>
        console.error('Failed to save user message', err),
      );
    }

    const history: AgentMessage[] = nextTurns
      .filter((t) => !(t.role === 'assistant' && t.pending))
      .map((t) => ({ role: t.role, content: t.text }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reply = await sendAgentChat(history, controller.signal);
      const toolCalls: StoredToolCall[] = reply.toolCalls.map((c) => ({ name: c.name, input: c.input }));
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        copy[copy.length - 1] = { ...last, text: reply.text, toolCalls, pending: false };
        return copy;
      });
      if (activeThreadId) {
        void saveMessage({
          threadId: activeThreadId,
          role: 'assistant',
          content: reply.text,
          toolCalls,
        }).catch((err) => console.error('Failed to save assistant message', err));
      }
    } catch (err) {
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last,
            text: `⚠️ ${err instanceof Error ? err.message : 'Request failed'}`,
            pending: false,
          };
        }
        return copy;
      });
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (creatingThread) void refreshSideData();
    }
  };

  const pickPrompt = (prompt: string, autosend = false) => {
    if (autosend) {
      void send(prompt);
      return;
    }
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const favoriteSet = new Set(favorites.map((f) => f.prompt));

  const toggleFavorite = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean) return;
    const existing = favorites.find((f) => f.prompt === clean);
    try {
      if (existing) {
        await removeFavorite(existing.id);
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      } else {
        const created = await addFavorite(clean);
        setFavorites((prev) => [created, ...prev.filter((f) => f.prompt !== clean)]);
      }
    } catch (err) {
      console.error('Favorite toggle failed', err);
    }
  };

  const startResize = (e: React.MouseEvent) => {
    if (effectiveMode === 'floating') return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = effectiveMode === 'right' ? startX - ev.clientX : ev.clientX - startX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      setSidebarWidth(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300 hover:bg-blue-700 transition-colors"
        aria-label="Open coach chat"
      >
        <MessageCircle size={20} />
        <span className="hidden sm:inline text-sm font-medium">Ask Coach</span>
      </button>
    );
  }

  const containerClass =
    effectiveMode === 'floating'
      ? 'fixed bottom-6 right-6 z-40 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-3rem))] rounded-3xl shadow-2xl shadow-blue-200 border border-blue-100'
      : effectiveMode === 'left'
      ? 'fixed top-0 left-0 z-40 h-screen border-r border-blue-100 shadow-xl shadow-blue-200'
      : 'fixed top-0 right-0 z-40 h-screen border-l border-blue-100 shadow-xl shadow-blue-200';

  const containerStyle =
    effectiveMode === 'floating' ? undefined : { width: `${sidebarWidth}px` };

  const showWelcome = turns.length === 0;

  return (
    <div
      className={`${containerClass} flex flex-col bg-white overflow-hidden`}
      style={containerStyle}
    >
      {effectiveMode !== 'floating' && (
        <div
          onMouseDown={startResize}
          className={`absolute top-0 ${
            effectiveMode === 'left' ? 'right-0' : 'left-0'
          } w-1.5 h-full cursor-col-resize hover:bg-blue-200/60 active:bg-blue-300/60 z-10`}
          title="Drag to resize"
        />
      )}

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={18} />
          <span className="font-semibold text-sm truncate">Hit Flow Coach</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={newChat}
            className="p-1 rounded hover:bg-white/20"
            title="New chat"
            aria-label="New chat"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`p-1 rounded ${showHistory ? 'bg-white/30' : 'hover:bg-white/20'}`}
            title="History"
            aria-label="History"
          >
            <History size={16} />
          </button>
          {!isMobile && (
            <>
              <button
                onClick={() => setMode(mode === 'left' ? 'floating' : 'left')}
                className={`p-1 rounded ${mode === 'left' ? 'bg-white/30' : 'hover:bg-white/20'}`}
                title="Dock left"
                aria-label="Dock left"
              >
                <PanelLeft size={16} />
              </button>
              <button
                onClick={() => setMode(mode === 'right' ? 'floating' : 'right')}
                className={`p-1 rounded ${mode === 'right' ? 'bg-white/30' : 'hover:bg-white/20'}`}
                title="Dock right"
                aria-label="Dock right"
              >
                <PanelRight size={16} />
              </button>
              {mode !== 'floating' && (
                <button
                  onClick={() => setMode('floating')}
                  className="p-1 rounded hover:bg-white/20"
                  title="Float"
                  aria-label="Float"
                >
                  <Move size={16} />
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-full hover:bg-white/20"
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        {showHistory ? (
          <HistoryView
            threads={recentThreads}
            currentId={threadId}
            onOpen={openThread}
            onDelete={dropThread}
            onClose={() => setShowHistory(false)}
          />
        ) : showWelcome ? (
          <WelcomeView
            favorites={favorites}
            recentThreads={recentThreads}
            onPick={pickPrompt}
            onToggleFavorite={toggleFavorite}
            onOpenThread={openThread}
          />
        ) : (
          <div className="px-4 py-3 space-y-3">
            {turns.map((t, i) => (
              <MessageBubble
                key={i}
                turn={t}
                isFavorited={t.role === 'user' && favoriteSet.has(t.text.trim())}
                onToggleFavorite={() => t.role === 'user' && toggleFavorite(t.text)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-2 flex items-center gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask about your workouts or supplements…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-h-32"
          disabled={busy}
        />
        <button
          onClick={() => void send()}
          disabled={busy || !input.trim()}
          className="p-2 rounded-full bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
          aria-label="Send message"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

function WelcomeView(props: {
  favorites: ChatFavorite[];
  recentThreads: ChatThreadMeta[];
  onPick: (prompt: string) => void;
  onToggleFavorite: (prompt: string) => void;
  onOpenThread: (id: string) => void;
}) {
  const { favorites, recentThreads, onPick, onToggleFavorite, onOpenThread } = props;
  const favSet = new Set(favorites.map((f) => f.prompt));
  return (
    <div className="px-4 py-4 space-y-5 text-sm">
      <div>
        <p className="text-gray-700 mb-2">
          Hi! I can analyze your training and supplement data. Here's what I can pull:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CAPABILITIES.map((cap) => (
            <span
              key={cap.tool}
              title={cap.description}
              className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5"
            >
              {cap.icon}
              {cap.label}
            </span>
          ))}
        </div>
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Try one
        </h3>
        <ul className="space-y-1">
          {EXAMPLE_PROMPTS.map((p) => (
            <li key={p}>
              <PromptRow
                text={p}
                favorited={favSet.has(p)}
                onPick={() => onPick(p)}
                onToggleFavorite={() => onToggleFavorite(p)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          ⭐ Saved
        </h3>
        {favorites.length === 0 ? (
          <p className="text-xs text-gray-400">
            Star a prompt above or any question you ask to keep it here.
          </p>
        ) : (
          <ul className="space-y-1">
            {favorites.map((f) => (
              <li key={f.id}>
                <PromptRow
                  text={f.prompt}
                  favorited
                  onPick={() => onPick(f.prompt)}
                  onToggleFavorite={() => onToggleFavorite(f.prompt)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Recent chats
        </h3>
        {recentThreads.length === 0 ? (
          <p className="text-xs text-gray-400">No chats yet — your conversations appear here.</p>
        ) : (
          <ul className="space-y-1">
            {recentThreads.slice(0, 6).map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onOpenThread(t.id)}
                  className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50"
                >
                  <span className="truncate text-gray-700">{t.title}</span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {relativeTime(t.updated_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PromptRow(props: {
  text: string;
  favorited: boolean;
  onPick: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 rounded-lg hover:bg-gray-50">
      <button
        onClick={props.onPick}
        className="flex-1 text-left px-2 py-1.5 text-gray-800 text-sm rounded-lg"
      >
        {props.text}
      </button>
      <button
        onClick={props.onToggleFavorite}
        className={`p-1.5 rounded-md ${
          props.favorited
            ? 'text-yellow-500'
            : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500'
        }`}
        title={props.favorited ? 'Remove from saved' : 'Save prompt'}
        aria-label={props.favorited ? 'Remove from saved' : 'Save prompt'}
      >
        {props.favorited ? <Star size={14} fill="currentColor" /> : <Star size={14} />}
      </button>
    </div>
  );
}

function HistoryView(props: {
  threads: ChatThreadMeta[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">All chats</h3>
        <button
          onClick={props.onClose}
          className="text-xs text-blue-600 hover:underline"
        >
          Done
        </button>
      </div>
      {props.threads.length === 0 ? (
        <p className="text-xs text-gray-400">You don't have any saved chats yet.</p>
      ) : (
        <ul className="space-y-1">
          {props.threads.map((t) => (
            <li
              key={t.id}
              className={`group flex items-center gap-1 rounded-lg ${
                t.id === props.currentId ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <button
                onClick={() => props.onOpen(t.id)}
                className="flex-1 text-left px-2 py-1.5 min-w-0"
              >
                <div className="truncate text-gray-800">{t.title}</div>
                <div className="text-[10px] text-gray-400">{relativeTime(t.updated_at)}</div>
              </button>
              <button
                onClick={() => props.onDelete(t.id)}
                className="p-1.5 rounded-md text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500"
                title="Delete chat"
                aria-label="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageBubble(props: {
  turn: ChatTurn;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}) {
  const t = props.turn;
  return (
    <div className={`group flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {t.role === 'user' && (
        <button
          onClick={props.onToggleFavorite}
          className={`self-center mr-1 p-1 rounded-md ${
            props.isFavorited
              ? 'text-yellow-500 opacity-100'
              : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500'
          }`}
          title={props.isFavorited ? 'Saved' : 'Save prompt'}
          aria-label={props.isFavorited ? 'Saved prompt' : 'Save prompt'}
        >
          {props.isFavorited ? (
            <Star size={14} fill="currentColor" />
          ) : (
            <StarOff size={14} />
          )}
        </button>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          t.role === 'user'
            ? 'bg-blue-600 text-white whitespace-pre-wrap'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {t.role === 'assistant' && t.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {t.toolCalls.map((c, j) => (
              <span
                key={j}
                title={`Called ${c.name}`}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-white text-gray-600 border border-gray-200 rounded-full px-2 py-0.5"
              >
                <Wrench size={10} />
                {c.name}
              </span>
            ))}
          </div>
        )}
        {t.role === 'assistant' ? (
          t.text ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-blue-600 underline"
                  />
                ),
                table: ({ node, ...props }) => (
                  <table
                    {...props}
                    className="my-2 text-xs border-collapse border border-gray-300"
                  />
                ),
                th: ({ node, ...props }) => (
                  <th
                    {...props}
                    className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-semibold"
                  />
                ),
                td: ({ node, ...props }) => (
                  <td {...props} className="border border-gray-300 px-2 py-1" />
                ),
                code: ({ node, className, children, ...props }) => {
                  const inline = !className;
                  return inline ? (
                    <code
                      {...props}
                      className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-[0.85em]"
                    >
                      {children}
                    </code>
                  ) : (
                    <code {...props} className={className}>
                      {children}
                    </code>
                  );
                },
                pre: ({ node, ...props }) => (
                  <pre
                    {...props}
                    className="my-2 bg-gray-900 text-gray-100 p-2 rounded-md text-xs overflow-x-auto"
                  />
                ),
                ul: ({ node, ...props }) => (
                  <ul {...props} className="list-disc pl-5 my-1 space-y-0.5" />
                ),
                ol: ({ node, ...props }) => (
                  <ol {...props} className="list-decimal pl-5 my-1 space-y-0.5" />
                ),
                p: ({ node, ...props }) => <p {...props} className="my-1" />,
                h1: ({ node, ...props }) => (
                  <h1 {...props} className="text-base font-bold mt-2 mb-1" />
                ),
                h2: ({ node, ...props }) => (
                  <h2 {...props} className="text-sm font-bold mt-2 mb-1" />
                ),
                h3: ({ node, ...props }) => (
                  <h3 {...props} className="text-sm font-semibold mt-1.5 mb-1" />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    {...props}
                    className="border-l-2 border-gray-300 pl-3 my-1 text-gray-700"
                  />
                ),
              }}
            >
              {t.text}
            </ReactMarkdown>
          ) : (
            t.pending && <Loader2 size={14} className="animate-spin text-gray-400" />
          )
        ) : (
          t.text
        )}
      </div>
    </div>
  );
}

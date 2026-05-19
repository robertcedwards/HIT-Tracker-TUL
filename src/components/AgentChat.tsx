import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2, Wrench, PanelLeft, PanelRight, Move } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendAgentChat, AgentMessage } from '../lib/agentClient';

type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: string[]; pending: boolean };

type ChatMode = 'floating' | 'left' | 'right';

const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 420;
const MOBILE_BREAKPOINT = 768;

function loadPref<T>(key: string, fallback: T, parse: (raw: string) => T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
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

  const effectiveMode: ChatMode = isMobile ? 'floating' : mode;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');

    const nextTurns: ChatTurn[] = [
      ...turns,
      { role: 'user', text },
      { role: 'assistant', text: '', toolCalls: [], pending: true },
    ];
    setTurns(nextTurns);
    setBusy(true);

    const history: AgentMessage[] = nextTurns
      .filter((t) => !(t.role === 'assistant' && t.pending))
      .map((t) => ({ role: t.role, content: t.text }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reply = await sendAgentChat(history, controller.signal);
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        copy[copy.length - 1] = {
          ...last,
          text: reply.text,
          toolCalls: reply.toolCalls.map((c) => c.name),
          pending: false,
        };
        return copy;
      });
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

  return (
    <div
      className={`${containerClass} flex flex-col bg-white overflow-hidden`}
      style={containerStyle}
    >
      {/* Resize handle on the inner edge in sidebar mode */}
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
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-semibold text-sm">Hit Flow Coach</span>
        </div>
        <div className="flex items-center gap-1">
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

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {turns.length === 0 && (
          <div className="text-sm text-gray-500 mt-4">
            <p className="mb-2">Ask about your training. For example:</p>
            <ul className="space-y-1 text-xs">
              <li>· "How's my chest press progressing over the last month?"</li>
              <li>· "What was my heaviest squat this quarter?"</li>
              <li>· "Did I miss any supplements this week?"</li>
            </ul>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              t.role === 'user'
                ? 'ml-auto bg-blue-600 text-white whitespace-pre-wrap'
                : 'mr-auto bg-gray-100 text-gray-900'
            }`}
          >
            {t.role === 'assistant' && t.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {t.toolCalls.map((name, j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-white text-gray-600 border border-gray-200 rounded-full px-2 py-0.5"
                  >
                    <Wrench size={10} />
                    {name}
                  </span>
                ))}
              </div>
            )}
            {t.role === 'assistant' ? (
              t.text ? (
                <div className="prose-chat">
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
                </div>
              ) : (
                t.pending && <Loader2 size={14} className="animate-spin text-gray-400" />
              )
            ) : (
              t.text
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 p-2 flex items-center gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask about your workouts or supplements…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 max-h-32"
          disabled={busy}
        />
        <button
          onClick={send}
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

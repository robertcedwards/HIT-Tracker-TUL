import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Loader2, Wrench } from 'lucide-react';
import { streamAgentChat, AgentMessage } from '../lib/agentClient';

type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: string[]; pending: boolean };

export function AgentChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [turns]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

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
      await streamAgentChat(history, (event) => {
        setTurns((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (!last || last.role !== 'assistant') return prev;
          if (event.type === 'text') {
            copy[copy.length - 1] = { ...last, text: last.text + event.delta };
          } else if (event.type === 'tool_use') {
            copy[copy.length - 1] = {
              ...last,
              toolCalls: [...last.toolCalls, event.name],
            };
          } else if (event.type === 'done') {
            copy[copy.length - 1] = { ...last, pending: false };
          } else if (event.type === 'error') {
            copy[copy.length - 1] = {
              ...last,
              text: last.text + (last.text ? '\n\n' : '') + `⚠️ ${event.message}`,
              pending: false,
            };
          }
          return copy;
        });
      }, controller.signal);
    } catch (err) {
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last,
            text: last.text + `\n\n⚠️ ${err instanceof Error ? err.message : 'Request failed'}`,
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

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-3rem))] flex flex-col bg-white rounded-3xl shadow-2xl shadow-blue-200 border border-blue-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-semibold text-sm">Hit Flow Coach</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-full hover:bg-white/20"
          aria-label="Close chat"
        >
          <X size={18} />
        </button>
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
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              t.role === 'user'
                ? 'ml-auto bg-blue-600 text-white'
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
            {t.text || (t.role === 'assistant' && t.pending && (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            ))}
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

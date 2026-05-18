import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Hit Flow Coach, an AI assistant embedded in a high-intensity training (HIT) app. The user tracks workouts (weight + time-under-load per exercise) and supplement intake. You help them analyze trends, spot plateaus, suggest progressions, and answer questions about their data.

Style:
- Concise. Lead with the answer; back it with one or two specific numbers from the user's data.
- Use the user's units as they appear in the data (the app stores weight; the user's preferred display unit is set client-side).
- When you reference a workout or supplement, cite the date in ISO format.
- If the user's question requires data, call a tool — do not guess. If no relevant data exists, say so plainly.
- Never invent exercise names, supplement names, or numbers.

You have read-only access to the user's data via tools. You cannot modify, add, or delete records.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_exercises',
    description: "List all exercises the user has logged, with the count of sessions and date of the most recent session for each.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_recent_workouts',
    description: 'Get all workout sessions in the last N days, across all exercises. Returns date, exercise name, weight, and time under load (seconds).',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days to look back. Default 30. Max 365.' },
      },
      required: [],
    },
  },
  {
    name: 'get_exercise_history',
    description: 'Get the recent session history for one specific exercise, ordered newest first. Use this to analyze progress on a particular lift.',
    input_schema: {
      type: 'object',
      properties: {
        exercise_name: { type: 'string', description: 'Exact name of the exercise (case-insensitive match).' },
        limit: { type: 'integer', description: 'Max number of sessions. Default 20.' },
      },
      required: ['exercise_name'],
    },
  },
  {
    name: 'compute_workout_stats',
    description: 'Compute aggregate workout stats over the last N days: total sessions, sessions per exercise, and the heaviest weight logged per exercise (proxy for PR).',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days to look back. Default 90.' },
      },
      required: [],
    },
  },
  {
    name: 'list_user_supplements',
    description: "List the supplements in the user's personal supplement list, with default dosages.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_supplement_log',
    description: "Get the user's supplement intake log for the last N days. Returns timestamp, supplement name, and dosage (mg).",
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Number of days to look back. Default 14.' },
      },
      required: [],
    },
  },
];

// Add cache_control to the LAST tool so tools + system are cached together.
// (Tools render before system; the breakpoint on the last system block caches both.)
const CACHED_TOOLS: Anthropic.Tool[] = TOOLS.map((t, i) =>
  i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t,
);

const CACHED_SYSTEM: Anthropic.TextBlockParam[] = [
  { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
];

function clampDays(d: unknown, fallback: number, max = 365): number {
  const n = typeof d === 'number' ? d : Number(d);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case 'list_exercises': {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, last_updated, sessions(id, timestamp)')
        .eq('user_id', userId)
        .order('name');
      if (error) throw error;
      return (data ?? []).map((e: any) => ({
        name: e.name,
        session_count: e.sessions?.length ?? 0,
        last_session: e.sessions?.length
          ? e.sessions.reduce((a: any, b: any) => (a.timestamp > b.timestamp ? a : b)).timestamp
          : null,
      }));
    }

    case 'get_recent_workouts': {
      const days = clampDays(input.days, 30);
      const since = isoDaysAgo(days);
      const { data, error } = await supabase
        .from('sessions')
        .select('timestamp, weight, time_under_load, exercises!inner(name, user_id)')
        .eq('exercises.user_id', userId)
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        date: s.timestamp,
        exercise: s.exercises?.name,
        weight: s.weight,
        time_under_load_seconds: s.time_under_load,
      }));
    }

    case 'get_exercise_history': {
      const exerciseName = String(input.exercise_name ?? '').trim();
      if (!exerciseName) throw new Error('exercise_name is required');
      const limit = clampDays(input.limit, 20, 200);
      const { data: ex, error: exErr } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('user_id', userId)
        .ilike('name', exerciseName)
        .maybeSingle();
      if (exErr) throw exErr;
      if (!ex) return { matched: null, sessions: [] };
      const { data, error } = await supabase
        .from('sessions')
        .select('timestamp, weight, time_under_load')
        .eq('exercise_id', ex.id)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return {
        matched: ex.name,
        sessions: (data ?? []).map((s: any) => ({
          date: s.timestamp,
          weight: s.weight,
          time_under_load_seconds: s.time_under_load,
        })),
      };
    }

    case 'compute_workout_stats': {
      const days = clampDays(input.days, 90);
      const since = isoDaysAgo(days);
      const { data, error } = await supabase
        .from('sessions')
        .select('weight, timestamp, exercises!inner(name, user_id)')
        .eq('exercises.user_id', userId)
        .gte('timestamp', since)
        .limit(2000);
      if (error) throw error;
      const byExercise = new Map<string, { count: number; heaviest: number; lastDate: string }>();
      for (const s of (data ?? []) as any[]) {
        const name = s.exercises?.name ?? 'unknown';
        const prev = byExercise.get(name);
        if (!prev) {
          byExercise.set(name, { count: 1, heaviest: s.weight ?? 0, lastDate: s.timestamp });
        } else {
          prev.count += 1;
          if ((s.weight ?? 0) > prev.heaviest) prev.heaviest = s.weight;
          if (s.timestamp > prev.lastDate) prev.lastDate = s.timestamp;
        }
      }
      return {
        window_days: days,
        total_sessions: data?.length ?? 0,
        per_exercise: Array.from(byExercise.entries()).map(([name, v]) => ({
          exercise: name,
          sessions: v.count,
          heaviest_weight: v.heaviest,
          last_session: v.lastDate,
        })),
      };
    }

    case 'list_user_supplements': {
      const { data, error } = await supabase
        .from('user_supplements')
        .select('custom_dosage_mg, notes, supplements:supplement_id(name, brand, default_dosage_mg)')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((u: any) => ({
        name: u.supplements?.name,
        brand: u.supplements?.brand,
        dosage_mg: u.custom_dosage_mg ?? u.supplements?.default_dosage_mg,
        notes: u.notes,
      }));
    }

    case 'get_supplement_log': {
      const days = clampDays(input.days, 14, 365);
      const since = isoDaysAgo(days);
      const { data, error } = await supabase
        .from('supplement_usage')
        .select('timestamp, dosage_mg, user_supplements:user_supplement_id(supplements:supplement_id(name, brand))')
        .eq('user_id', userId)
        .gte('timestamp', since)
        .order('timestamp', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((u: any) => ({
        timestamp: u.timestamp,
        supplement: u.user_supplements?.supplements?.name,
        brand: u.user_supplements?.supplements?.brand,
        dosage_mg: u.dosage_mg,
      }));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function sse(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase env vars not configured' }), { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!jwt) return new Response(JSON.stringify({ error: 'Missing bearer token' }), { status: 401 });

  // Build a Supabase client scoped to the user's JWT so RLS enforces user isolation.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }
  const userId = userData.user.id;

  let body: { messages?: Anthropic.MessageParam[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 });
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(sse(event, data));
      const convo: Anthropic.MessageParam[] = [...messages];

      try {
        let safety = 0;
        while (safety++ < 8) {
          const turn = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            system: CACHED_SYSTEM,
            tools: CACHED_TOOLS,
            messages: convo,
          });

          turn.on('text', (delta) => send('text', { delta }));

          const finalMessage = await turn.finalMessage();

          if (finalMessage.stop_reason === 'tool_use') {
            const toolUses = finalMessage.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
            );
            convo.push({ role: 'assistant', content: finalMessage.content });

            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const tu of toolUses) {
              send('tool_use', { name: tu.name, input: tu.input });
              try {
                const out = await runTool(tu.name, tu.input as Record<string, unknown>, supabase, userId);
                results.push({
                  type: 'tool_result',
                  tool_use_id: tu.id,
                  content: JSON.stringify(out),
                });
              } catch (err) {
                results.push({
                  type: 'tool_result',
                  tool_use_id: tu.id,
                  content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                  is_error: true,
                });
              }
            }
            convo.push({ role: 'user', content: results });
            continue;
          }

          send('done', {
            stop_reason: finalMessage.stop_reason,
            usage: finalMessage.usage,
          });
          break;
        }
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          send('error', { status: err.status, message: err.message });
        } else {
          send('error', { message: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    },
  });
};

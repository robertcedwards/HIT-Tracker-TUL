import type { Handler } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import ws from 'ws';

// Machine-to-machine API for hardware devices (M5Stack Stopwatch, etc).
//
// Devices can't run the normal Google-OAuth Supabase login, so they authenticate
// with an opaque long-lived token. This function validates that token itself and
// writes data with the Supabase service-role key (bypassing RLS), scoped to the
// user_id the device was paired to.
//
// Pairing (QR) flow:
//   1. device  -> POST ?action=pair                 (no auth)  => { token, pairing_code, pair_url }
//   2. device renders QR of pair_url, polls status
//   3. user    -> POST ?action=claim { code }       (user JWT) => binds device to user
//   4. device  -> GET  ?action=status               (device token) => { status, exercises }
//   5. device  -> POST ?action=session { ... }       (device token) => logs a workout set

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const APP_URL = process.env.VITE_APP_URL || 'https://hitflow.xyz';

const TOKEN_PREFIX = 'hf_dev_';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// 8 chars, unambiguous uppercase alphabet (no 0/O/1/I) — easy to read on a small screen.
function makePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function makeToken(): string {
  return TOKEN_PREFIX + randomBytes(20).toString('hex'); // hf_dev_ + 40 hex chars
}

function bearer(event: { headers?: Record<string, string | undefined> }): string {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

type DeviceRow = {
  id: string;
  user_id: string | null;
  name: string;
  status: string;
};

// Resolve a device-token bearer header to its active device row, or null.
async function authDevice(
  admin: SupabaseClient,
  token: string,
): Promise<DeviceRow | null> {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const { data, error } = await admin
    .from('devices')
    .select('id, user_id, name, status')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== 'active' || !data.user_id) return null;
  return data as DeviceRow;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { error: 'Supabase service-role env vars not configured' });
  }

  const action = event.queryStringParameters?.action || '';

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as any },
  });

  let body: Record<string, unknown> = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
  }

  try {
    switch (action) {
      // ---- 1. Device self-registers, gets a token + pairing code ----------
      case 'pair': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
        const name =
          typeof body.device_name === 'string' && body.device_name.trim()
            ? body.device_name.trim().slice(0, 60)
            : 'M5 Stopwatch';

        const token = makeToken();
        let pairingCode = makePairingCode();

        // Retry once on the (astronomically unlikely) pairing_code collision.
        for (let attempt = 0; attempt < 2; attempt++) {
          const { data, error } = await admin
            .from('devices')
            .insert({
              name,
              pairing_code: pairingCode,
              token_hash: sha256(token),
              token_prefix: token.slice(0, 8),
              status: 'pending',
            })
            .select('id')
            .single();

          if (!error && data) {
            return json(200, {
              device_id: data.id,
              token,
              pairing_code: pairingCode,
              pair_url: `${APP_URL}/link-device?code=${pairingCode}`,
              poll_interval_seconds: 3,
            });
          }
          if (error?.code === '23505') {
            pairingCode = makePairingCode();
            continue; // unique violation on pairing_code — regenerate
          }
          throw error;
        }
        return json(500, { error: 'Could not allocate pairing code' });
      }

      // ---- 2. Logged-in user claims a pending device (binds to account) ----
      case 'claim': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
        const jwt = bearer(event);
        if (!jwt) return json(401, { error: 'Missing bearer token' });

        const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
        if (userErr || !userData.user) return json(401, { error: 'Invalid token' });

        const userId = userData.user.id;
        const code = String(body.code ?? '').trim().toUpperCase();
        if (!code) return json(400, { error: 'code is required' });

        const { data: device, error: findErr } = await admin
          .from('devices')
          .select('id, status, user_id, name')
          .eq('pairing_code', code)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!device) return json(404, { error: 'Unknown or expired pairing code' });

        // Idempotent: a re-claim of an already-active device (StrictMode double
        // fire, or a page refresh) succeeds for the owner and is rejected for
        // anyone else. The pairing_code is left in place so this lookup still
        // resolves; it is inert once status is active (claims are gated below).
        if (device.status === 'active') {
          if (device.user_id === userId) {
            return json(200, { ok: true, name: device.name, already_linked: true });
          }
          return json(409, { error: 'This device is linked to another account' });
        }
        if (device.status !== 'pending') {
          return json(409, { error: 'This device has been revoked' });
        }

        const { data: updated, error: updErr } = await admin
          .from('devices')
          .update({
            user_id: userId,
            status: 'active',
            claimed_at: new Date().toISOString(),
          })
          .eq('id', device.id)
          .eq('status', 'pending') // guard against a concurrent claim
          .select('name')
          .maybeSingle();
        if (updErr) throw updErr;
        if (!updated) {
          // Lost a concurrent race — if the winner was this same user, still OK.
          const { data: now } = await admin
            .from('devices')
            .select('status, user_id, name')
            .eq('id', device.id)
            .maybeSingle();
          if (now && now.status === 'active' && now.user_id === userId) {
            return json(200, { ok: true, name: now.name, already_linked: true });
          }
          return json(409, { error: 'This device has already been linked' });
        }

        return json(200, { ok: true, name: updated.name });
      }

      // ---- 3. Device polls its pairing status / fetches exercise list ------
      case 'status': {
        const token = bearer(event);
        if (!token || !token.startsWith(TOKEN_PREFIX)) {
          return json(401, { error: 'Missing device token' });
        }
        const { data, error } = await admin
          .from('devices')
          .select('id, user_id, name, status')
          .eq('token_hash', sha256(token))
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(401, { error: 'Unknown device token' });

        await admin
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', data.id);

        if (data.status !== 'active' || !data.user_id) {
          return json(200, { status: data.status });
        }

        const { data: exercises, error: exErr } = await admin
          .from('exercises')
          .select('id, name')
          .eq('user_id', data.user_id)
          .order('name');
        if (exErr) throw exErr;

        return json(200, {
          status: 'active',
          device_name: data.name,
          exercises: exercises ?? [],
        });
      }

      // ---- 4. Device submits a logged workout set --------------------------
      case 'session': {
        if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
        const device = await authDevice(admin, bearer(event));
        if (!device || !device.user_id) {
          return json(401, { error: 'Invalid or revoked device token' });
        }
        const userId = device.user_id;

        const weight = Number(body.weight);
        const timeUnderLoad = Number(body.time_under_load);
        if (!Number.isFinite(weight) || weight < 0) {
          return json(400, { error: 'weight must be a non-negative number' });
        }
        if (!Number.isFinite(timeUnderLoad) || timeUnderLoad < 0) {
          return json(400, { error: 'time_under_load must be a non-negative number' });
        }

        // Resolve the exercise: by id (must belong to the user) or find-or-create by name.
        let exerciseId: string | null = null;
        if (typeof body.exercise_id === 'string' && body.exercise_id) {
          const { data: ex, error } = await admin
            .from('exercises')
            .select('id')
            .eq('id', body.exercise_id)
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          if (!ex) return json(404, { error: 'exercise_id not found for this account' });
          exerciseId = ex.id;
        } else {
          const exerciseName = String(body.exercise_name ?? '').trim();
          if (!exerciseName) {
            return json(400, { error: 'exercise_id or exercise_name is required' });
          }
          const { data: existing, error: findErr } = await admin
            .from('exercises')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', exerciseName)
            .maybeSingle();
          if (findErr) throw findErr;
          if (existing) {
            exerciseId = existing.id;
          } else {
            const { data: created, error: createErr } = await admin
              .from('exercises')
              .insert({
                name: exerciseName,
                user_id: userId,
                last_updated: new Date().toISOString(),
              })
              .select('id')
              .single();
            if (createErr) throw createErr;
            exerciseId = created.id;
          }
        }

        const timestamp =
          typeof body.timestamp === 'string' && body.timestamp
            ? body.timestamp
            : new Date().toISOString();

        const { data: session, error: insErr } = await admin
          .from('sessions')
          .insert({
            exercise_id: exerciseId,
            weight,
            time_under_load: timeUnderLoad,
            timestamp,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;

        await admin
          .from('exercises')
          .update({ last_updated: timestamp })
          .eq('id', exerciseId);
        await admin
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', device.id);

        return json(200, { ok: true, session_id: session.id });
      }

      default:
        return json(400, {
          error: 'Unknown action. Use ?action=pair|claim|status|session',
        });
    }
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
};

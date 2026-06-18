import { supabase } from './supabase';

const ENDPOINT = '/.netlify/functions/device-api';

export type Device = {
  id: string;
  name: string;
  token_prefix: string;
  status: 'pending' | 'active' | 'revoked';
  created_at: string;
  claimed_at: string | null;
  last_seen_at: string | null;
};

// Bind a pending hardware device (identified by the pairing code from its QR)
// to the signed-in user's account.
export async function claimDevice(code: string): Promise<{ name: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const res = await fetch(`${ENDPOINT}?action=claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `Linking failed (${res.status})`);
  }
  return { name: payload.name ?? 'Device' };
}

// List the user's devices (RLS scopes this to the current user).
export async function listDevices(): Promise<Device[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('id, name, token_prefix, status, created_at, claimed_at, last_seen_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Device[];
}

// Revoke a device so its token can no longer submit sessions.
export async function revokeDevice(id: string): Promise<void> {
  const { error } = await supabase
    .from('devices')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw error;
}

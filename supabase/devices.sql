-- Hardware device pairing + auth for Hit Flow.
-- Backs the M5Stack Stopwatch (and any future hardware) submitting workout
-- sessions through the `device-api` Netlify function.
--
-- Apply via the Supabase SQL editor (project ref qaujynofythxbnhnczda).
-- There is no migrations runner in this repo.

CREATE TABLE IF NOT EXISTS public.devices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- null until a logged-in user claims the device via the QR pairing flow
    user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    name          text NOT NULL DEFAULT 'M5 Stopwatch',
    -- short human code shown in the QR; inert once status is active (the
    -- device-api claim is gated by status, so a re-claim is idempotent)
    pairing_code  text UNIQUE,
    -- sha256 of the opaque device token (the raw token is never stored)
    token_hash    text NOT NULL,
    -- first 8 chars of the raw token, for display in the Profile devices list
    token_prefix  text NOT NULL,
    status        text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'revoked')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    claimed_at    timestamptz,
    last_seen_at  timestamptz
);

CREATE INDEX IF NOT EXISTS devices_token_hash_idx   ON public.devices (token_hash);
CREATE INDEX IF NOT EXISTS devices_pairing_code_idx ON public.devices (pairing_code);
CREATE INDEX IF NOT EXISTS devices_user_id_idx      ON public.devices (user_id);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Users can list and revoke their own devices from the web app (with their JWT).
-- All other mutations (pair / claim / status / session) go through the
-- service-role `device-api` function, which bypasses RLS. There is deliberately
-- NO insert policy and the update policy is scoped to the owner, so a device row
-- can never be created or hijacked with a normal anon/auth key.

CREATE POLICY "Users can read their own devices" ON public.devices
    FOR SELECT USING (user_id = auth.uid());

-- Allows revoking (status -> 'revoked') from the Profile page.
CREATE POLICY "Users can update their own devices" ON public.devices
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own devices" ON public.devices
    FOR DELETE USING (user_id = auth.uid());

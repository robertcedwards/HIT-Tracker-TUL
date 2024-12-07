import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { supabase } from '../../../../lib/supabase';
import { config } from '../../../../lib/config';

const client = new NeynarAPIClient({
  apiKey: config.neynarApiKey
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    const { signer } = await client.signInWithNeynar.verify(code);
    const { user } = await client.lookupUserBySigner({ signerUuid: signer.signerUuid });

    const { error } = await supabase.auth.signUp({
      email: `${user.username}@farcaster.xyz`,
      password: signer.signerUuid,
      options: {
        data: {
          farcaster_id: user.fid,
          username: user.username,
          display_name: user.displayName,
          avatar_url: user.pfp.url,
        },
      },
    });

    if (error) throw error;

    return Response.redirect(`${config.appUrl}?token=${signer.signerUuid}`);
  } catch (error) {
    console.error('Neynar callback error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
} 
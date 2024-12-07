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
    const { token } = await client.signIn.verify(code);
    const user = await client.user.getUser(token);

    const { error } = await supabase.auth.signUp({
      email: `${user.username}@farcaster.xyz`,
      password: token,
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

    return Response.redirect(`${config.appUrl}?token=${token}`);
  } catch (error) {
    console.error('Neynar callback error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
} 
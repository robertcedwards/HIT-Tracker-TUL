import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { supabase } from '../../../../lib/supabase';
import { config } from '../../../../lib/config';

const client = new NeynarAPIClient(config.neynarApiKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    const { success, data } = await client.signIn.verify(code);
    if (!success) {
      throw new Error('Sign in verification failed');
    }

    const { error } = await supabase.auth.signUp({
      email: `${data.fid}@farcaster.xyz`,
      password: data.token,
      options: {
        data: {
          farcaster_id: data.fid,
          username: data.username || data.fid.toString(),
          display_name: data.display_name || data.fid.toString(),
          avatar_url: data.pfp_url || '',
        },
      },
    });

    if (error) throw error;

    return Response.redirect(`${config.appUrl}?token=${data.token}`);
  } catch (error) {
    console.error('Neynar callback error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
} 
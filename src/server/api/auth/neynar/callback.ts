import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { supabase } from '../../../../lib/supabase';

const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('No code provided', { status: 400 });
  }

  try {
    const { token } = await client.verifySignInAttempt(code);
    const { user } = await client.lookupUserByVerificationToken(token);

    // Create or update user in Supabase
    const { data: supabaseUser, error } = await supabase.auth.signUp({
      email: `${user.username}@farcaster.xyz`,
      password: token, // You might want to handle this differently
      options: {
        data: {
          farcaster_id: user.fid,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.pfp_url,
        },
      },
    });

    if (error) throw error;

    return Response.redirect(`${process.env.VITE_APP_URL}?token=${token}`);
  } catch (error) {
    console.error('Neynar callback error:', error);
    return new Response('Authentication failed', { status: 500 });
  }
} 
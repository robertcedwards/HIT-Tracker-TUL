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
    const signer = await client.verifySignInAttempt(code);
    const signerData = await client.lookupSigner({ signerUuid: signer.signerUuid });

    const { error } = await supabase.auth.signUp({
      email: `${signerData.signer.fid}@farcaster.xyz`,
      password: signer.signerUuid,
      options: {
        data: {
          farcaster_id: signerData.signer.fid,
          username: signerData.signer.fid.toString(),
          display_name: signerData.signer.fid.toString(),
          avatar_url: '',
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
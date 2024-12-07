import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'neynar-auth',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/auth/neynar')) {
            try {
              const { NeynarAPIClient } = await import('@neynar/nodejs-sdk');
              const neynarClient = new NeynarAPIClient(process.env.VITE_NEYNAR_API_KEY);

              if (req.url === '/api/auth/neynar/signin') {
                const signInResponse = await neynarClient.signInWithNeynar({
                  success_redirect_url: `${process.env.VITE_APP_URL}/api/auth/neynar/callback`,
                  cancel_redirect_url: `${process.env.VITE_APP_URL}/login`,
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ url: signInResponse.signin_url }));
              } else if (req.url.startsWith('/api/auth/neynar/callback')) {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const code = url.searchParams.get('code');

                if (!code) {
                  res.statusCode = 400;
                  res.end('No code provided');
                  return;
                }

                const { token } = await neynarClient.verifySignInAttempt(code);
                const { user } = await neynarClient.lookupUserByVerificationToken(token);

                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  process.env.VITE_SUPABASE_URL!,
                  process.env.VITE_SUPABASE_ANON_KEY!
                );

                const { error } = await supabase.auth.signUp({
                  email: `${user.username}@farcaster.xyz`,
                  password: token,
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
                res.statusCode = 302;
                res.setHeader('Location', `/?token=${token}`);
                res.end();
              }
            } catch (error) {
              res.statusCode = 500;
              res.end('Authentication failed');
            }
          } else {
            next();
          }
        });
      },
    },
  ],
});

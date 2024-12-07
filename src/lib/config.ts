export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  neynarApiKey: import.meta.env.VITE_NEYNAR_API_KEY,
  appUrl: import.meta.env.VITE_APP_URL,
} as const;

// Validate environment variables
Object.entries(config).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}); 
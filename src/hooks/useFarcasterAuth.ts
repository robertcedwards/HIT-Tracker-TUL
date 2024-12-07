import { useState } from 'react';
import { config } from '../lib/config';

export function useFarcasterAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithFarcaster = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${config.appUrl}/api/auth/neynar/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Farcaster sign in');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Farcaster auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signInWithFarcaster,
    isLoading,
    error,
  };
} 
import { useFarcasterAuth } from '../hooks/useFarcasterAuth';

export function FarcasterAuth() {
  const { signInWithFarcaster, isLoading, error } = useFarcasterAuth();

  return (
    <div>
      <button
        onClick={signInWithFarcaster}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {isLoading ? 'Connecting...' : 'Sign in with Farcaster'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
} 
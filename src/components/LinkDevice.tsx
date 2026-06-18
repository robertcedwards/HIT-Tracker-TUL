import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Dumbbell, Watch, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { claimDevice } from '../lib/devices';
import { AuthComponent } from './Auth';

type Status = 'idle' | 'linking' | 'success' | 'error';

export function LinkDevice() {
  const [params] = useSearchParams();
  const code = (params.get('code') || '').trim().toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  // Guards against a duplicate claim — React StrictMode double-invokes effects in
  // dev, and a page refresh re-runs this. A ref flips synchronously, so claim
  // fires exactly once regardless.
  const claimStarted = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Once signed in (and we have a code), claim the device exactly once.
  useEffect(() => {
    if (!session || !code || claimStarted.current) return;
    claimStarted.current = true;
    setStatus('linking');
    claimDevice(code)
      .then(({ name }) => {
        setStatus('success');
        setMessage(name);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not link the device.');
      });
  }, [session, code]);

  const card = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Dumbbell className="w-9 h-9 text-blue-500" />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
              Hit Flow
            </h1>
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-8 text-center">
          {children}
        </div>
        <div className="mt-6 text-center">
          <Link to="/" className="text-blue-500 hover:text-blue-600">← Back to app</Link>
        </div>
      </div>
    </div>
  );

  if (!authReady) {
    return card(<Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />);
  }

  if (!code) {
    return card(
      <>
        <Watch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No pairing code</h2>
        <p className="text-gray-600">
          Scan the QR code shown on your Hit Flow device to link it to your account.
        </p>
      </>,
    );
  }

  // Not signed in yet — show login. The ?code= stays in the URL, so the claim
  // fires automatically once auth completes.
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="max-w-md mx-auto">
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Watch className="w-8 h-8 text-blue-500" />
              <h1 className="text-2xl font-bold text-gray-800">Link your device</h1>
            </div>
            <p className="text-gray-600">Sign in to connect this device to your account.</p>
          </div>
          <AuthComponent />
        </div>
      </div>
    );
  }

  if (status === 'linking') {
    return card(
      <>
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Linking device…</h2>
      </>,
    );
  }

  if (status === 'success') {
    return card(
      <>
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Device linked!</h2>
        <p className="text-gray-600 mb-6">
          <span className="font-medium">{message}</span> is now connected. Workouts you log
          on it will appear in your Hit Flow account.
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors"
        >
          Done
        </Link>
      </>,
    );
  }

  return card(
    <>
      <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Couldn't link device</h2>
      <p className="text-gray-600">{message}</p>
    </>,
  );
}

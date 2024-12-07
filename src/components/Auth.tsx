import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { FarcasterAuth } from './FarcasterAuth';

export function AuthComponent() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-2 mb-8">
          <h1 className="text-2xl font-bold">Hit Flow</h1>
        </div>
        
        <div className="space-y-6">
          <FarcasterAuth />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']}
          />
        </div>
      </div>
    </div>
  );
} 
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { Info, CheckCircle, Clock, BarChart2, Dumbbell } from 'lucide-react';

export function AuthComponent() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Dumbbell className="w-10 h-10 text-blue-500" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
            Hit Flow
          </h1>
        </div>
        <p className="text-gray-600">Track your high-intensity training sessions with precision</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Info className="mr-2 text-blue-500" size={24} />
              About Hit Flow
            </h3>
            <p className="text-gray-600">
              Hit Flow is a specialized tracking tool designed for high-intensity training protocols,
              focusing on time under load and weight progression. Created by{' '}
              <a href="https://warpcast.com/0xhashbrown" className="text-blue-500 hover:text-blue-600">@0xhashbrown</a>,
              this app helps you optimize your strength training journey.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <CheckCircle className="mr-2 text-green-500" size={24} />
              Data Usage
            </h3>
            <div className="text-gray-700">
              <p className="mb-2">We request access to your data for:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Email: Account authentication only</li>
                <li>Exercise data: Progress tracking and insights</li>
                <li>Session history: Performance visualization</li>
              </ul>
              <p className="mt-2">
                <a href="/privacy" className="inline-flex items-center text-blue-700 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1">
                  View our Privacy Policy 
                  <span className="ml-1" aria-hidden="true">→</span>
                  <span className="sr-only">(opens privacy policy)</span>
                </a>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <Clock className="mr-2 text-yellow-600" size={24} />
              Features
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Track weights and time under load</li>
              <li>Audio countdown alerts</li>
              <li>Progress visualization</li>
              <li>Data export and account management</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <BarChart2 className="mr-2 text-purple-500" size={24} />
              Your Data Control
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Export your data anytime</li>
              <li>Delete your account and data permanently</li>
              <li>Access all your information through your profile</li>
            </ul>
          </section>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">Sign In to Get Started</h2>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google']}
          />
          <div className="mt-4 pt-4 border-t text-sm text-gray-500 text-center">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-blue-500 hover:text-blue-600">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-blue-500 hover:text-blue-600">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
} 
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { Info, CheckCircle, Clock, BarChart2, Dumbbell } from 'lucide-react';

export function AuthComponent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Dumbbell className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
              Hit Flow
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Track your high-intensity training with precision</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Info Cards */}
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-lg shadow-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Info className="text-blue-500" size={24} />
                </div>
                <h3 className="text-xl font-semibold">Overview</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">
                Track your high-intensity training sessions with focus on time under load
                and weight progression. Perfect for SuperSlow and time-based strength training.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-lg shadow-green-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-xl">
                  <CheckCircle className="text-green-500" size={24} />
                </div>
                <h3 className="text-xl font-semibold">Key Features</h3>
              </div>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Track weights and time under load
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Audio countdown alerts
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Progress visualization
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  Cloud sync across devices
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-6 shadow-lg shadow-yellow-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-xl">
                    <Clock className="text-yellow-500" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold">Timer</h3>
                </div>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                    Independent timers
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                    Audio alerts
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-lg shadow-purple-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-xl">
                    <BarChart2 className="text-purple-500" size={24} />
                  </div>
                  <h3 className="text-lg font-semibold">Progress</h3>
                </div>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Visual graphs
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    Data history
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Sign In to Get Started</h2>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                style: {
                  button: {
                    borderRadius: '12px',
                    height: '44px',
                  },
                  input: {
                    borderRadius: '12px',
                    height: '44px',
                  },
                },
              }}
              providers={['google']}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
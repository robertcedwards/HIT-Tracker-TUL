import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft size={20} />
          Back to App
        </Link>
        
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Collection and Storage</h2>
            <p>We collect and store the following information:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Exercise data (names, weights, and durations)</li>
              <li>Session timestamps</li>
              <li>Authentication information (email for login)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Usage</h2>
            <p>Your data is used exclusively to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Track your exercise progress</li>
              <li>Generate performance graphs</li>
              <li>Provide personalized exercise history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Protection</h2>
            <p>We protect your data by:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Using Supabase's secure infrastructure</li>
              <li>Implementing row-level security</li>
              <li>Encrypting all data in transit and at rest</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Access your stored data</li>
              <li>Request data deletion</li>
              <li>Export your exercise history</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
} 
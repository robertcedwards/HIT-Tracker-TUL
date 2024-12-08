import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg shadow-blue-100 p-8">
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
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Your Data Rights</h2>
            <p>You have complete control over your data. Through your profile page, you can:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Export all your data in JSON format at any time</li>
              <li>Download a complete history of your exercises and sessions</li>
              <li>Permanently delete your account and all associated data</li>
              <li>Access and review all your stored information</li>
            </ul>
            <p className="mt-3 text-sm">
              To manage your data, visit your <Link to="/profile" className="text-blue-500 hover:text-blue-600">Profile Settings</Link> page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Analytics</h2>
            <p>We use Umami Analytics to collect anonymous usage data. This helps us improve the app and includes:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Page views and basic usage patterns</li>
              <li>No personal information is collected</li>
              <li>No cookies are used</li>
              <li>Data is anonymized and cannot be traced back to individuals</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Retention</h2>
            <p>Your data is retained as follows:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Active accounts: Data is stored until you choose to delete it</li>
              <li>Account deletion: All data is permanently removed upon account deletion</li>
              <li>Exports: Downloaded data files are not retained on our servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact</h2>
            <p>For any privacy-related questions or concerns, you can:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Visit your profile page to manage your data</li>
              <li>Contact us on <a href="https://warpcast.com/0xhashbrown" className="text-blue-500 hover:text-blue-600">Warpcast @0xhashbrown</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
} 
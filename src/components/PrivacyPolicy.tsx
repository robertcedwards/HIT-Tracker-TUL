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
        
        <h1 className="text-3xl font-bold mb-6">Hit Flow Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-6">Last Updated: December 8, 2023</p>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Introduction</h2>
            <p>Hit Flow ("we", "our", or "us") is committed to protecting your privacy. This policy explains how we handle your data when you use our high-intensity training tracking application at hitflow.xyz.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Google User Data</h2>
            <p className="mb-2">When you sign in with Google, we access:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Your Google email address for account authentication</li>
              <li>Basic profile information (name and profile picture)</li>
            </ul>
            <p className="mt-2">This data is used exclusively for:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Creating and managing your Hit Flow account</li>
              <li>Displaying your profile information within the app</li>
              <li>Account-related communications</li>
            </ul>
            <p className="mt-2">We do not:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Share your Google data with third parties</li>
              <li>Use your data for advertising purposes</li>
              <li>Access any other Google account information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Exercise Data Collection</h2>
            <p>We collect and store:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Exercise data (names, weights, and durations)</li>
              <li>Session timestamps</li>
              <li>Performance metrics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Storage and Security</h2>
            <p>Your data is protected by:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Secure hosting on Supabase's infrastructure</li>
              <li>Encryption in transit and at rest</li>
              <li>Row-level security policies</li>
              <li>Regular security audits</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Your Data Rights</h2>
            <p>Through your profile page, you can:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Export all your data in JSON format</li>
              <li>Delete your account and all associated data</li>
              <li>Review and manage your stored information</li>
              <li>Revoke Google access permissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Analytics</h2>
            <p>We use Umami Analytics to collect anonymous usage data:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Page views and basic usage patterns</li>
              <li>No personal information is collected</li>
              <li>No cookies are used</li>
              <li>Data is anonymized</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Policy Updates</h2>
            <p>When we make changes to this policy:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Users will be notified via email of significant changes</li>
              <li>Updates will be posted on this page with a new "Last Updated" date</li>
              <li>Changes affecting Google user data will be clearly highlighted</li>
              <li>Users may be required to acknowledge significant changes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Contact Information</h2>
            <p>For privacy-related questions or concerns:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Email: privacy@hitflow.xyz</li>
              <li>Warpcast: <a href="https://warpcast.com/0xhashbrown" className="text-blue-500 hover:text-blue-600">@0xhashbrown</a></li>
              <li>Visit your profile page to manage data settings</li>
            </ul>
          </section>

          <section className="mt-8 pt-8 border-t">
            <p className="text-sm text-gray-500">
              This privacy policy is specific to Hit Flow and was last updated on December 8, 2023. 
              The policy is hosted on our verified domain hitflow.xyz and applies to all users of the application.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
} 
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
          <ArrowLeft size={20} />
          Back to App
        </Link>
        
        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        
        <div className="space-y-6 text-gray-600">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Acceptance of Terms</h2>
            <p>By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Use License</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>Personal, non-commercial use only</li>
              <li>You may not modify or copy the application's code</li>
              <li>You may not use the service for any illegal purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Disclaimer</h2>
            <p>This application is provided "as is". Use the exercise tracking features at your own risk. Consult with healthcare professionals before starting any exercise program.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Account Terms</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-2">
              <li>You are responsible for maintaining your account security</li>
              <li>You must provide accurate account information</li>
              <li>You may not use the service for unauthorized purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Modifications</h2>
            <p>We reserve the right to modify or discontinue the service at any time without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the service.</p>
          </section>
        </div>
      </div>
    </div>
  );
} 
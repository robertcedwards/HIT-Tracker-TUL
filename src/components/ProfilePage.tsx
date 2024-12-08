import { useState, useEffect } from 'react';
import { User, Settings, Download, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { getExercises } from '../lib/database';

export function ProfilePage() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      setUserData(user);
    }
    loadUserData();
  }, []);

  const handleExportData = async () => {
    try {
      if (!userData?.id) return;

      const exercises = await getExercises(userData.id);
      
      // Convert data to JSON and create download
      const exportData = {
        userData: {
          email: userData.email,
          id: userData.id,
        },
        exercises,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hit-flow-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (!userData?.id) return;

      // Delete user's exercises first
      const { error: exercisesError } = await supabase
        .from('exercises')
        .delete()
        .eq('user_id', userData.id);

      if (exercisesError) throw exercisesError;

      // Delete user account
      const { error: userError } = await supabase.auth.admin.deleteUser(
        userData.id
      );

      if (userError) throw userError;

      // Sign out after deletion
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
    }
  };

  if (!userData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6">
            <ArrowLeft size={20} />
            Back to App
          </Link>
          <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-100 rounded-2xl">
                <User className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Profile Settings</h1>
                <p className="text-gray-600">Manage your account and data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-xl">
              <User className="text-purple-500" size={20} />
            </div>
            <h2 className="text-xl font-semibold">Account Information</h2>
          </div>
          
          <div className="space-y-4 text-gray-600">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
              <span>Email</span>
              <span className="font-medium">{userData.email}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
              <span>Account Created</span>
              <span className="font-medium">
                {new Date(userData.created_at || '').toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-3xl shadow-lg shadow-blue-100 p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-xl">
              <Settings className="text-green-500" size={20} />
            </div>
            <h2 className="text-xl font-semibold">Data Management</h2>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-4 text-left text-gray-700 bg-gray-50 rounded-2xl hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <div>
                <div className="font-medium">Export Your Data</div>
                <div className="text-sm text-gray-600">Download all your exercise data as JSON</div>
              </div>
              <Download size={20} />
            </button>

            <button
              onClick={() => setIsDeleting(true)}
              className="w-full flex items-center justify-between p-4 text-left text-red-700 bg-red-50 rounded-2xl hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            >
              <div>
                <div className="font-medium">Delete Account</div>
                <div className="text-sm text-red-600">Permanently delete your account and all data</div>
              </div>
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {/* Delete Confirmation */}
        {isDeleting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Delete Account?</h3>
              <p className="text-gray-600 mb-6">
                This action cannot be undone. All your data will be permanently deleted.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleting(false)}
                  className="flex-1 px-6 py-3 text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 px-6 py-3 text-white bg-red-500 rounded-2xl hover:bg-red-600 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
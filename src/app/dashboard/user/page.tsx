'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Link from 'next/link';

export default function UserDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
    router.push('/');
    router.refresh();
  };

  return (
    <ProtectedRoute role="user">
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">User Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
        <div className="flex space-x-4">
          <Link href="/dashboard/user/submit-grievance">
            <button className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              Submit Grievance
            </button>
          </Link>
          <Link href="/dashboard/user/track-grievance">
            <button className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition">
              Track Grievance
            </button>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
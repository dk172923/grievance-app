'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function AdminDashboard() {
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
    <ProtectedRoute role="admin">
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
        <p>Welcome, Admin! Manage grievances and assignments here.</p>
        <div className="mt-8">
          <a
            href="/dashboard/admin/problem-hotspots"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition font-semibold"
          >
            View Problem Hotspots (K-means Clustering)
          </a>
        </div>
      </div>
    </ProtectedRoute>
  );
}
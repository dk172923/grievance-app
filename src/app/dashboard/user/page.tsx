'use client';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function UserDashboard() {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
    router.push('/');
    router.refresh(); // Force refresh to clear client-side state
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
        <p>Welcome, User! You can submit or track grievances here.</p>
      </div>
    </ProtectedRoute>
  );
}
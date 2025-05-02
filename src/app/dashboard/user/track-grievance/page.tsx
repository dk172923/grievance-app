'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Link from 'next/link';

// Define Grievance interface
interface Grievance {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  language: string;
  location: string;
  file_url: string | null;
  created_at: string;
  categories: { name: string };
  profiles?: { name: string; designation: string; location: string };
}

export default function GrievanceTracking() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGrievances();
  }, []);

  const fetchGrievances = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      const { data, error } = await supabase
        .from('grievances')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          language,
          location,
          file_url,
          created_at,
          categories!category_id (name),
          profiles:assigned_employee_id (name, designation, location)
        `)
        .eq('user_id', sessionData.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGrievances(data || []);
    } catch (error: any) {
      console.error('Error fetching grievances:', error);
      setError(error.message || 'Failed to load grievances.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute role="user">
      <div className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
        <h2 className="text-2xl font-bold mb-6">Track Your Grievances</h2>
        {loading && <p className="text-gray-600">Loading grievances...</p>}
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {!loading && grievances.length === 0 && (
          <p className="text-gray-600">No grievances found.</p>
        )}
        {grievances.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Priority</th>
                  <th className="p-3 text-left">Assigned To</th>
                  <th className="p-3 text-left">Submitted On</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map((grievance) => (
                  <tr key={grievance.id} className="border-b">
                    <td className="p-3">{grievance.title}</td>
                    <td className="p-3">{grievance.categories.name}</td>
                    <td className="p-3">{grievance.status}</td>
                    <td className="p-3">{grievance.priority}</td>
                    <td className="p-3">
                      {grievance.profiles
                        ? `${grievance.profiles.name} (${grievance.profiles.designation}, ${grievance.profiles.location})`
                        : 'Unassigned'}
                    </td>
                    <td className="p-3">
                      {new Date(grievance.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/dashboard/user/grievance/${grievance.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6">
          <Link
            href="/dashboard/user"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
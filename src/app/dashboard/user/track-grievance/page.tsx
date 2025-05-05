'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../../components/Header';

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="user" />
        <div className="max-w-5xl mx-auto p-8">
          <h2 className="text-4xl font-extrabold text-gray-800 mb-8 text-center animate-fade-in-down">
            Track Your Grievances
          </h2>
          {loading && (
            <p className="text-gray-600 text-lg animate-pulse text-center">
              Loading grievances...
            </p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center animate-fade-in">
              {error}
            </p>
          )}
          {!loading && grievances.length === 0 && (
            <p className="text-gray-600 bg-white p-6 rounded-lg shadow-md text-center animate-fade-in">
              No grievances found.
            </p>
          )}
          {grievances.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl shadow-lg">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-4 text-left">Title</th>
                    <th className="p-4 text-left">Category</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Priority</th>
                    <th className="p-4 text-left">Assigned To</th>
                    <th className="p-4 text-left">Submitted On</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grievances.map((grievance) => (
                    <tr
                      key={grievance.id}
                      className="border-b hover:bg-gray-50 transition-all duration-200"
                    >
                      <td className="p-4">{grievance.title}</td>
                      <td className="p-4">{grievance.categories.name}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            grievance.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : grievance.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : grievance.status === 'Resolved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {grievance.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            grievance.priority === 'High'
                              ? 'bg-red-100 text-red-800'
                              : grievance.priority === 'Medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {grievance.priority}
                        </span>
                      </td>
                      <td className="p-4">
                        {grievance.profiles
                          ? `${grievance.profiles.name} (${grievance.profiles.designation}, ${grievance.profiles.location})`
                          : 'Unassigned'}
                      </td>
                      <td className="p-4">
                        {new Date(grievance.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/dashboard/user/grievance/${grievance.id}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline transition-all duration-200"
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
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/user"
              className="px-5 py-2.5 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 transition-all duration-300 animate-fade-in"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 1s ease-out;
        }
        .animate-fade-in {
          animation: fadeInDown 1s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
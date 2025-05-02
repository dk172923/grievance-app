'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Link from 'next/link';

interface Grievance {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  location: string;
  created_at: string;
  categories: { name: string };
  profiles?: { name: string; designation: string; location: string };
}

interface Delegation {
  id: number;
  delegated_at: string;
  from_employee: { name: string; designation: string };
  to_employee: { name: string; designation: string };
}

export default function GrievanceDetails() {
  const router = useRouter();
  const { id } = useParams();
  const [grievance, setGrievance] = useState<Grievance | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchGrievance();
    }
  }, [id]);

  const fetchGrievance = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      // Fetch grievance details
      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          location,
          created_at,
          categories!category_id (name),
          profiles:assigned_employee_id (name, designation, location)
        `)
        .eq('id', id)
        .eq('user_id', sessionData.session.user.id)
        .single();

      if (grievanceError || !grievanceData) throw new Error('Grievance not found or unauthorized.');

      // Fetch delegation history
      const { data: delegationData, error: delegationError } = await supabase
        .from('grievance_delegations')
        .select(`
          id,
          delegated_at,
          from_employee:from_employee_id (name, designation),
          to_employee:to_employee_id (name, designation)
        `)
        .eq('grievance_id', id)
        .order('delegated_at', { ascending: false });

      if (delegationError) throw delegationError;

      setGrievance(grievanceData as Grievance);
      setDelegations((delegationData || []) as Delegation[]);
    } catch (error: any) {
      console.error('Error fetching grievance:', error);
      setError(error.message || 'Failed to load grievance details.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    router.push('/');
    router.refresh();
  };

  return (
    <ProtectedRoute role="user">
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Grievance Details</h1>
          <div className="space-x-4">
            <Link
              href="/dashboard/user"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Back to Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-600 mb-4">{error}</p>}
        {grievance && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-2xl font-semibold mb-4">{grievance.title}</h2>
            <p className="mb-2"><strong>Description:</strong> {grievance.description}</p>
            <p className="mb-2"><strong>Category:</strong> {grievance.categories.name}</p>
            <p className="mb-2"><strong>Status:</strong> {grievance.status}</p>
            <p className="mb-2"><strong>Priority:</strong> {grievance.priority}</p>
            <p className="mb-2"><strong>Location:</strong> {grievance.location}</p>
            <p className="mb-2"><strong>Created At:</strong> {new Date(grievance.created_at).toLocaleString()}</p>
            <p className="mb-2">
              <strong>Assigned To:</strong> {grievance.profiles ? grievance.profiles.name : 'Unassigned'}
            </p>
          </div>
        )}
        <h2 className="text-2xl font-semibold mb-4">Delegation History</h2>
        {delegations.length === 0 ? (
          <p className="text-gray-600">No delegation history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-3 text-left">Delegated At</th>
                  <th className="p-3 text-left">From Employee</th>
                  <th className="p-3 text-left">To Employee</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((delegation) => (
                  <tr key={delegation.id} className="border-b">
                    <td className="p-3">{new Date(delegation.delegated_at).toLocaleString()}</td>
                    <td className="p-3">
                      {delegation.from_employee.name} ({delegation.from_employee.designation})
                    </td>
                    <td className="p-3">
                      {delegation.to_employee.name} ({delegation.to_employee.designation})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
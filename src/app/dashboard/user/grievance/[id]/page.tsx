'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../../../components/Header';

interface GrievanceAction {
  id: number;
  action_text: string;
  created_at: string;
  employee: { name: string; designation: string };
}

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
  actions?: GrievanceAction[];
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
          profiles:assigned_employee_id (name, designation, location),
          grievance_actions!grievance_id (
            id,
            action_text,
            created_at,
            employee:profiles!grievance_actions_employee_id_fkey (name, designation)
          )
        `)
        .eq('id', id)
        .eq('user_id', sessionData.session.user.id)
        .single();

      if (grievanceError || !grievanceData) throw new Error('Grievance not found or unauthorized.');

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

      const normalizedGrievance = {
        ...grievanceData,
        categories: Array.isArray(grievanceData.categories) ? grievanceData.categories[0] : grievanceData.categories,
        profiles: Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles,
        actions: Array.isArray(grievanceData.grievance_actions)
          ? grievanceData.grievance_actions.map((a: any) => ({
              id: a.id,
              action_text: a.action_text,
              created_at: a.created_at,
              employee: a.employee,
            }))
          : [],
      };

      setGrievance(normalizedGrievance as Grievance);
      setDelegations((delegationData || []) as Delegation[]);
    } catch (error: any) {
      console.error('Error fetching grievance:', error);
      setError(error.message || 'Failed to load grievance details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute role="user">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="user" />
        <div className="max-w-4xl mx-auto p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-800 animate-fade-in-down">
              Grievance Details
            </h1>
            <Link
              href="/dashboard/user"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all duration-300 animate-fade-in"
            >
              Back to Dashboard
            </Link>
          </div>
          {loading && (
            <p className="text-gray-600 text-lg animate-pulse">Loading grievance details...</p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner animate-fade-in">
              {error}
            </p>
          )}
          {grievance && (
            <div className="bg-white p-8 rounded-xl shadow-lg mb-8 animate-fade-in">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">{grievance.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Description:</strong> {grievance.description}
                  </p>
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Category:</strong> {grievance.categories.name}
                  </p>
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Status:</strong>
                    <span
                      className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
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
                  </p>
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Priority:</strong>
                    <span
                      className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                        grievance.priority === 'High'
                          ? 'bg-red-100 text-red-800'
                          : grievance.priority === 'Medium'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {grievance.priority}
                    </span>
                  </p>
                </div>
                <div className="space-y-4">
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Location:</strong> {grievance.location}
                  </p>
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Created At:</strong>{' '}
                    {new Date(grievance.created_at).toLocaleString()}
                  </p>
                  <p className="text-gray-700">
                    <strong className="text-gray-900">Assigned To:</strong>{' '}
                    {grievance.profiles ? grievance.profiles.name : 'Unassigned'}
                  </p>
                </div>
              </div>
            </div>
          )}
          <h2 className="text-3xl font-semibold text-gray-800 mb-6 animate-fade-in">
            Delegation History
          </h2>
          {delegations.length === 0 ? (
            <p className="text-gray-600 bg-white p-6 rounded-lg shadow-md animate-fade-in">
              No delegation history available.
            </p>
          ) : (
            <div className="overflow-x-auto mb-8">
              <table className="w-full bg-white rounded-xl shadow-lg">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-4 text-left">Delegated At</th>
                    <th className="p-4 text-left">From Employee</th>
                    <th className="p-4 text-left">To Employee</th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map((delegation) => (
                    <tr key={delegation.id} className="border-b hover:bg-gray-50 transition-all duration-200">
                      <td className="p-4">{new Date(delegation.delegated_at).toLocaleString()}</td>
                      <td className="p-4">
                        {delegation.from_employee.name} ({delegation.from_employee.designation})
                      </td>
                      <td className="p-4">
                        {delegation.to_employee.name} ({delegation.to_employee.designation})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2 className="text-3xl font-semibold text-gray-800 mb-6 animate-fade-in">Action History</h2>
          {grievance?.actions && grievance.actions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl shadow-lg">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="p-4 text-left">Action</th>
                    <th className="p-4 text-left">Employee</th>
                    <th className="p-4 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {grievance.actions.map((action) => (
                    <tr key={action.id} className="border-b hover:bg-gray-50 transition-all duration-200">
                      <td className="p-4">{action.action_text}</td>
                      <td className="p-4">
                        {action.employee.name} ({action.employee.designation})
                      </td>
                      <td className="p-4">{new Date(action.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 bg-white p-6 rounded-lg shadow-md animate-fade-in">
              No actions taken yet.
            </p>
          )}
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
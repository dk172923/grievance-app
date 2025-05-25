'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Header from '../../../components/Header';
import Link from 'next/link';

interface Employee {
  id: string;
  name: string;
  designation: string;
}

interface Grievance {
  id: number;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  user_id: string;
  assigned_employee_id?: string;
  categories: { name: string };
  profiles?: { name: string; designation: string };
  assigned_by?: { name: string; designation: string };
}

interface Notification {
  id: number;
  message: string;
  grievance_id: number;
  is_read: boolean;
  created_at: string;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profile, setProfile] = useState<{ id: string; category_id: number; designation: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('All');

  useEffect(() => {
    const initialize = async () => {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;

      if (session) {
        const channel = supabase
          .channel('notifications')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${session.user.id}`,
            },
            (payload) => {
              setNotifications((prev) => [payload.new as Notification, ...prev]);
            }
          )
          .subscribe();

        await fetchData();
        await fetchNotifications();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };

    initialize();
  }, [priorityFilter]); // Add priorityFilter to dependency array to refetch when it changes

  const fetchData = async () => {
    try {
      setLoading(true);
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, category_id, designation, name, email')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) throw new Error('Profile not found.');
      setProfile(profileData);

      if (!profileData.category_id) throw new Error('Employee profile not assigned to a department.');

      const categoryId = profileData.category_id;
      const userId = session.user.id;
      const designation = profileData.designation;

      let grievancesQuery = supabase
        .from('grievances')
        .select(`
          id,
          title,
          status,
          priority,
          created_at,
          user_id,
          assigned_employee_id,
          categories!category_id (name),
          profiles!grievances_assigned_employee_id_fkey (name, designation),
          grievance_delegations!grievance_id (
            from_profile:from_employee_id (name, designation)
          )
        `)
        .in('status', ['Pending', 'In Progress'])
        .order('created_at', { ascending: false });

      if (priorityFilter !== 'All') {
        grievancesQuery = grievancesQuery.eq('priority', priorityFilter);
      }

      if (designation === 'Lead') {
        grievancesQuery = grievancesQuery.eq('category_id', categoryId);
      } else if (designation === 'Senior') {
        const { data: juniorIds } = await supabase
          .from('department_hierarchy')
          .select('employee_id')
          .eq('parent_employee_id', userId)
          .eq('category_id', categoryId);
        const ids = [userId, ...(juniorIds?.map(j => j.employee_id) || [])];
        grievancesQuery = grievancesQuery.in('assigned_employee_id', ids);
      } else {
        grievancesQuery = grievancesQuery.eq('assigned_employee_id', userId);
      }

      const { data: grievancesData, error: grievancesError } = await grievancesQuery;
      if (grievancesError) throw grievancesError;

      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, designation')
        .eq('category_id', categoryId)
        .eq('role', 'employee')
        .neq('id', userId)
        .in('designation', designation === 'Lead' ? ['Senior', 'Junior'] : ['Junior']);

      if (employeesError) throw employeesError;

      const processedGrievances = (grievancesData || []).map((g: any) => ({
        ...g,
        categories: Array.isArray(g.categories) ? g.categories[0] : g.categories,
        profiles: Array.isArray(g.profiles) ? g.profiles[0] : g.profiles,
        assigned_by: g.grievance_delegations[0]?.from_profile
          ? { name: g.grievance_delegations[0].from_profile.name, designation: g.grievance_delegations[0].from_profile.designation }
          : undefined,
      }));

      setGrievances(processedGrievances);
      setEmployees(employeesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    const sessionResponse = await supabase.auth.getSession();
    const session = sessionResponse.data.session;
    if (!session) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
  };

  const markNotificationAsRead = async (notificationId: number) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header
          role="employee"
          notifications={notifications}
          toggleNotifications={toggleNotifications}
          markNotificationAsRead={markNotificationAsRead}
          showNotifications={showNotifications}
        />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-800 animate-fade-in-down">
              Employee Dashboard
            </h1>
            <p className="mt-4 text-lg text-gray-600 animate-fade-in-up">
              Manage and resolve grievances efficiently.
            </p>
          </div>

          {/* <div className="w-full max-w-6xl mx-auto mt-8 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">Data Analysis</h2>
              <p className="mb-4 text-gray-600">Access our data visualization tools to identify problem hotspots and trends using our K-means clustering analysis.</p>
              <a
                href="/dashboard/employee/problem-hotspots"
                className="inline-block px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 shadow-md"
              >
                <span className="mr-2">📊</span> View Problem Hotspots
              </a>
            </div>
          </div> */}

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <label className="text-gray-700 font-medium">Filter by Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="All">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <Link
              href="/dashboard/employee/resolved"
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-300"
            >
              View Resolved/Finished Grievances
            </Link>
          </div>

          {loading && (
            <p className="text-gray-600 text-lg animate-pulse text-center">Loading grievances...</p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center animate-fade-in">{error}</p>
          )}

          <h2 className="text-3xl font-semibold text-gray-800 mb-6 animate-fade-in-down">Assigned Grievances</h2>
          {grievances.length === 0 ? (
            <p className="text-gray-600 text-lg bg-white p-6 rounded-lg shadow-md text-center animate-fade-in">
              No grievances assigned.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grievances.map((grievance) => (
                <div
                  key={grievance.id}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 animate-fade-in"
                >
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{grievance.title}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Category:</span>
                      <span className="text-sm text-gray-800">{grievance.categories.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Status:</span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          grievance.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : grievance.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {grievance.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Priority:</span>
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
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Assigned To:</span>
                      <span className="text-sm text-gray-800">
                        {grievance.profiles
                          ? `${grievance.profiles.name} (${grievance.profiles.designation})`
                          : 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Assigned By:</span>
                      <span className="text-sm text-gray-800">
                        {grievance.assigned_by
                          ? `${grievance.assigned_by.name} (${grievance.assigned_by.designation})`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Link
                      href={`/dashboard/employee/grievance/${grievance.id}`}
                      className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 1s ease-out;
        }
        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out;
        }
        .animate-fade-in {
          animation: fadeInDown 1s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Tree, { TreeNodeDatum } from 'react-d3-tree';
import Link from 'next/link';
import { EyeIcon, XMarkIcon, BellIcon } from '@heroicons/react/24/outline';

interface TreeNode {
  name: string;
  designation?: string;
  children?: TreeNode[];
}

interface Employee {
  id: string;
  name: string;
  designation: string;
}

interface GrievanceAction {
  id: number;
  action_text: string;
  created_at: string;
  employee: { name: string; designation: string };
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
  profiles?: { name: string; designation: string; location: string; email: string };
  submitter?: { id: string; email: string };
  assigned_by?: { name: string; designation: string };
  hierarchy?: TreeNode;
  actions?: GrievanceAction[];
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
  const [actionInputs, setActionInputs] = useState<{ [key: number]: string }>({});
  const [statusInputs, setStatusInputs] = useState<{ [key: number]: string }>({});
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
  }, []);

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
          profiles!grievances_assigned_employee_id_fkey (name, designation, location, email),
          submitter:profiles!grievances_user_id_fkey1 (id, email),
          grievance_delegations!grievance_id (
            from_employee_id,
            to_employee_id,
            from_profile:from_employee_id (name, designation),
            to_profile:to_employee_id (name, designation)
          ),
          grievance_actions!grievance_id (
            id,
            action_text,
            created_at,
            employee:profiles!grievance_actions_employee_id_fkey (name, designation)
          )
        `)
        .order('created_at', { ascending: false });

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

      setGrievances(
        (grievancesData || []).map((g: any) => {
          let hierarchy: TreeNode = { name: 'Unassigned', designation: '', children: [] };
          const delegations = Array.isArray(g.grievance_delegations) ? g.grievance_delegations : [];

          if (delegations.length > 0) {
            const employeeMap = new Map<string, TreeNode>();
            delegations.forEach((d: any) => {
              if (d.from_employee_id && d.from_profile) {
                employeeMap.set(d.from_employee_id, {
                  name: d.from_profile.name,
                  designation: d.from_profile.designation,
                  children: [],
                });
              }
              if (d.to_employee_id && d.to_profile) {
                employeeMap.set(d.to_employee_id, {
                  name: d.to_profile.name,
                  designation: d.to_profile.designation,
                  children: [],
                });
              }
            });

            delegations.forEach((d: any) => {
              const fromNode = d.from_employee_id ? employeeMap.get(d.from_employee_id) : null;
              const toNode = d.to_employee_id ? employeeMap.get(d.to_employee_id) : null;
              if (fromNode && toNode) {
                fromNode.children = fromNode.children || [];
                if (!fromNode.children.some(child => child.name === toNode.name)) {
                  fromNode.children.push(toNode);
                }
              }
            });

            const firstDelegation = delegations[0];
            if (firstDelegation.from_employee_id) {
              hierarchy = employeeMap.get(firstDelegation.from_employee_id) || hierarchy;
            }
          } else if (g.profiles) {
            hierarchy = { name: g.profiles.name, designation: g.profiles.designation, children: [] };
          }

          const actions = Array.isArray(g.grievance_actions)
            ? g.grievance_actions
                .map((a: any) => ({
                  id: a.id,
                  action_text: a.action_text,
                  created_at: a.created_at,
                  employee: a.employee,
                }))
                .sort((a: GrievanceAction, b: GrievanceAction) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
            : [];

          return {
            ...g,
            categories: Array.isArray(g.categories) ? g.categories[0] : g.categories,
            profiles: Array.isArray(g.profiles) ? g.profiles[0] : g.profiles,
            submitter: Array.isArray(g.submitter) ? g.submitter[0] : g.submitter,
            assigned_by: delegations[0]?.from_profile
              ? { name: delegations[0].from_profile.name, designation: delegations[0].from_profile.designation }
              : undefined,
            hierarchy,
            actions,
          };
        })
      );

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

  const triggerNotification = async (userId: string, email: string, message: string, grievanceId: number, type: string) => {
    try {
      const { error: dbError } = await supabase.from('notifications').insert({
        user_id: userId,
        message,
        grievance_id: grievanceId,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject: `Grievance Update: ${type}`, message }),
      });
    } catch (error) {
      console.error('Error triggering notification:', error);
    }
  };

  const handleDelegate = async (grievanceId: number, toEmployeeId: string) => {
    try {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');
      if (!['Lead', 'Senior'].includes(profile?.designation || '')) {
        throw new Error('Only Lead or Senior can delegate grievances.');
      }

      const { data: grievanceData } = await supabase
        .from('grievances')
        .select('assigned_employee_id')
        .eq('id', grievanceId)
        .single();

      const previousAssignedEmployeeId = grievanceData?.assigned_employee_id;

      const { error: updateError } = await supabase
        .from('grievances')
        .update({ assigned_employee_id: toEmployeeId })
        .eq('id', grievanceId);

      if (updateError) throw new Error(`Grievance update failed: ${updateError.message}`);

      const { error: delegationError } = await supabase
        .from('grievance_delegations')
        .insert({
          grievance_id: grievanceId,
          from_employee_id: session.user.id,
          to_employee_id: toEmployeeId,
        });

      if (delegationError) {
        console.error('Delegation insert error:', delegationError);
        throw new Error(`Delegation insert failed: ${delegationError.message}`);
      }

      const { data: toEmployee } = await supabase
        .from('profiles')
        .select('designation, email')
        .eq('id', toEmployeeId)
        .single();

      if (!toEmployee) throw new Error('Assignee profile not found.');

      const parentId = session.user.id;
      const { error: hierarchyError } = await supabase
        .from('department_hierarchy')
        .upsert(
          [
            {
              employee_id: toEmployeeId,
              parent_employee_id: parentId,
              category_id: profile?.category_id,
            },
          ],
          { onConflict: 'employee_id,category_id' }
        );

      if (hierarchyError) {
        console.error('Hierarchy upsert error:', hierarchyError);
        throw new Error(`Hierarchy upsert failed: ${hierarchyError.message}`);
      }

      const message = `Grievance #${grievanceId} has been delegated to you.`;
      await triggerNotification(toEmployeeId, toEmployee.email, message, grievanceId, 'Delegation');

      if (previousAssignedEmployeeId && previousAssignedEmployeeId !== toEmployeeId) {
        const { data: previousEmployee } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', previousAssignedEmployeeId)
          .single();
        if (previousEmployee) {
          const prevMessage = `Grievance #${grievanceId} has been reassigned from you.`;
          await supabase.from('notifications').insert({
            user_id: previousAssignedEmployeeId,
            message: prevMessage,
            grievance_id: grievanceId,
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }

      alert('Grievance delegated successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error delegating grievance:', error);
      setError(error.message || 'Failed to delegate grievance.');
    }
  };

  const handleActionSubmit = async (grievanceId: number) => {
    try {
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) throw new Error('User not authenticated.');

      const actionText = actionInputs[grievanceId]?.trim();
      const newStatus = statusInputs[grievanceId] || 'Pending';

      if (!actionText) throw new Error('Action text cannot be empty.');

      // Fetch the grievance details and join with profiles to get the submitter's email
      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select(`
          status,
          user_id,
          profiles:profiles!grievances_user_id_fkey1 (id, email, role)
        `)
        .eq('id', grievanceId)
        .single();

      if (grievanceError) throw new Error(`Failed to fetch grievance: ${grievanceError.message}`);
      if (!grievanceData) throw new Error('Grievance not found.');

      const oldStatus = grievanceData.status;
      const submitterId = grievanceData.user_id;
      const submitterProfile = Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles;

      // Ensure the profile exists and has role 'user'
      if (!submitterProfile || submitterProfile.role !== 'user') {
        throw new Error('Submitter profile not found or not a user.');
      }

      const submitterEmail = submitterProfile.email;
      if (!submitterEmail) throw new Error('Submitter email not found.');

      const { error: actionError } = await supabase
        .from('grievance_actions')
        .insert({
          grievance_id: grievanceId,
          employee_id: session.user.id,
          action_text: actionText,
        });

      if (actionError) throw new Error(`Action insert failed: ${actionError.message}`);

      const { error: statusError } = await supabase
        .from('grievances')
        .update({ status: newStatus })
        .eq('id', grievanceId)
        .eq('assigned_employee_id', session.user.id);

      if (statusError) throw new Error(`Status update failed: ${statusError.message}`);

      if (submitterId && submitterEmail) {
        const actionMessage = `New action added to Grievance #${grievanceId}: ${actionText}`;
        await triggerNotification(submitterId, submitterEmail, actionMessage, grievanceId, 'Action');

        if (oldStatus !== newStatus) {
          const statusMessage = `Grievance #${grievanceId} status changed from ${oldStatus} to ${newStatus}.`;
          await triggerNotification(submitterId, submitterEmail, statusMessage, grievanceId, 'Status Change');
        }
      }

      alert('Action added successfully!');
      setActionInputs({ ...actionInputs, [grievanceId]: '' });
      setStatusInputs({ ...statusInputs, [grievanceId]: 'Pending' });
      fetchData();
      fetchNotifications();
    } catch (error: any) {
      console.error('Error submitting action:', error);
      setError(error.message || 'Failed to submit action.');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    router.push('/');
    router.refresh();
  };

  const openHierarchyModal = (grievance: Grievance) => {
    setSelectedGrievance(grievance);
  };

  const closeHierarchyModal = () => {
    setSelectedGrievance(null);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-800">Employee Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button onClick={toggleNotifications} className="relative">
                  <BellIcon className="h-8 w-8 text-gray-800 hover:text-indigo-600 transition-all duration-300" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 h-5 w-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Notifications</h3>
                      {notifications.length === 0 ? (
                        <p className="text-gray-600">No unread notifications.</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className="p-3 mb-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-all duration-200 cursor-pointer"
                            onClick={() => markNotificationAsRead(notif.id)}
                          >
                            <p className="text-sm text-gray-800">{notif.message}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(notif.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Link
                href="/dashboard/employee/profile"
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-300"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg shadow-md hover:bg-red-700 transition-all duration-300"
              >
                Logout
              </button>
            </div>
          </div>

          {loading && (
            <p className="text-gray-600 text-lg animate-pulse">Loading grievances...</p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner">{error}</p>
          )}

          <h2 className="text-3xl font-semibold text-gray-800 mb-6">Assigned Grievances</h2>
          {grievances.length === 0 ? (
            <p className="text-gray-600 text-lg bg-white p-6 rounded-lg shadow-md">
              No grievances assigned.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {grievances.map((grievance) => (
                <div
                  key={grievance.id}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
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
                            : grievance.status === 'Resolved'
                            ? 'bg-green-100 text-green-800'
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
                    <button
                      onClick={() => openHierarchyModal(grievance)}
                      className="flex items-center w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-all duration-300"
                    >
                      <EyeIcon className="h-5 w-5 mr-2" />
                      View Hierarchy
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {grievance.assigned_employee_id === profile?.id && (
                      <div className="space-y-3">
                        <textarea
                          value={actionInputs[grievance.id] || ''}
                          onChange={(e) =>
                            setActionInputs({ ...actionInputs, [grievance.id]: e.target.value })
                          }
                          placeholder="Enter action taken"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                        />
                        <select
                          value={statusInputs[grievance.id] || grievance.status}
                          onChange={(e) =>
                            setStatusInputs({ ...statusInputs, [grievance.id]: e.target.value })
                          }
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <button
                          onClick={() => handleActionSubmit(grievance.id)}
                          className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300"
                        >
                          Submit Action
                        </button>
                      </div>
                    )}
                    {['Lead', 'Senior'].includes(profile?.designation || '') && (
                      <select
                        onChange={(e) => handleDelegate(grievance.id, e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Delegate To
                        </option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.designation})
                          </option>
                        ))}
                      </select>
                    )}
                    {grievance.actions && grievance.actions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Action History</h4>
                        <div
                          className="overflow-y-auto border border-gray-200 rounded-lg max-h-[120px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
                        >
                          <table className="w-full bg-white">
                            <thead>
                              <tr className="bg-gray-100 text-gray-700 text-left text-xs uppercase">
                                <th className="p-3">Action</th>
                                <th className="p-3">Employee</th>
                                <th className="p-3">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grievance.actions.map((action) => (
                                <tr key={action.id} className="border-t text-sm text-gray-600">
                                  <td className="p-3">{action.action_text}</td>
                                  <td className="p-3">
                                    {action.employee.name} ({action.employee.designation})
                                  </td>
                                  <td className="p-3">
                                    {new Date(action.created_at).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedGrievance && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-2xl w-11/12 max-w-4xl p-6 relative">
              <button
                onClick={closeHierarchyModal}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-all duration-200"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                Delegation Hierarchy: {selectedGrievance.title}
              </h3>
              <div className="border border-gray-200 rounded-lg p-4" style={{ height: '500px', width: '100%' }}>
                <Tree
                  data={selectedGrievance.hierarchy}
                  orientation="vertical"
                  translate={{ x: 350, y: 50 }}
                  pathFunc="step"
                  nodeSize={{ x: 200, y: 100 }}
                  renderCustomNodeElement={({ nodeDatum }) => (
                    <g>
                      <circle r="15" fill="#4f46e5" />
                      <text fill="black" strokeWidth="0" x="0" y="30" textAnchor="middle">
                        {nodeDatum.name} ({(nodeDatum as TreeNode).designation || ''})
                      </text>
                    </g>
                  )}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
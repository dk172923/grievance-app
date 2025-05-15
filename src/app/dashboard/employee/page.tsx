'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Tree, { TreeNodeDatum } from 'react-d3-tree';
import Header from '../../../components/Header';

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

  const triggerNotification = async (userId: string, email: string, messageTemplate: string, grievanceId: number, type: string) => {
    try {
      // Fetch the grievance title
      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select('title')
        .eq('id', grievanceId)
        .single();

      if (grievanceError || !grievanceData) {
        console.error('Error fetching grievance title:', grievanceError);
        return;
      }

      const grievanceTitle = grievanceData.title;
      // Replace the grievance ID with the title in the message
      const message = messageTemplate.replace(`#${grievanceId}`, `'${grievanceTitle}'`);

      const { error: dbError } = await supabase.from('notifications').insert({
        user_id: userId,
        message,
        grievance_id: grievanceId,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error('Error creating notification in database:', dbError);
        return;
      }

      // Try to send email notification, but don't fail if it doesn't work
      try {
        const response = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, subject: `Grievance Update: ${type}`, message }),
        });
        
        const data = await response.json();
        
        if (!data.success) {
          console.warn('Email notification not sent:', data.error || 'Unknown error');
        } else if (data.warning) {
          console.warn(data.warning);
        }
      } catch (emailError) {
        // Just log the error but don't fail the entire notification process
        console.error('Error sending email notification:', emailError);
      }
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
        .select('assigned_employee_id, user_id, profiles:profiles!grievances_user_id_fkey1 (id, email, role)')
        .eq('id', grievanceId)
        .single();

      const previousAssignedEmployeeId = grievanceData?.assigned_employee_id;
      const submitterId = grievanceData?.user_id;
      const submitterProfile = Array.isArray(grievanceData?.profiles) ? grievanceData.profiles[0] : grievanceData?.profiles;

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
        .select('designation, email, name')
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

      if (profile?.designation === 'Lead' && submitterId && submitterProfile?.role === 'user') {
        const submitterEmail = submitterProfile.email;
        if (submitterEmail) {
          const userMessage = `Your Grievance #${grievanceId} has been assigned to ${toEmployee.name} (${toEmployee.designation}).`;
          await triggerNotification(submitterId, submitterEmail, userMessage, grievanceId, 'Assignment');
        }
      }

      if (previousAssignedEmployeeId && previousAssignedEmployeeId !== toEmployeeId) {
        const { data: previousEmployee } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', previousAssignedEmployeeId)
          .single();
        if (previousEmployee) {
          const prevMessage = `Grievance #${grievanceId} has been reassigned from you.`;
          await triggerNotification(previousAssignedEmployeeId, previousEmployee.email, prevMessage, grievanceId, 'Reassignment');
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
      // Clear any previous errors
      setError(null);
      
      const sessionResponse = await supabase.auth.getSession();
      const session = sessionResponse.data.session;
      if (!session) {
        setError('User not authenticated. Please log in again.');
        return;
      }

      const actionText = actionInputs[grievanceId]?.trim();
      const newStatus = statusInputs[grievanceId] || 'Pending';

      // Client-side validation
      if (!actionText) {
        setError('Action text cannot be empty. Please provide details about the action taken.');
        // Focus on the textarea
        const textarea = document.querySelector(`textarea[data-grievance-id="${grievanceId}"]`) as HTMLTextAreaElement;
        if (textarea) textarea.focus();
        return;
      }

      const { data: grievanceData, error: grievanceError } = await supabase
        .from('grievances')
        .select(`
          status,
          user_id,
          profiles:profiles!grievances_user_id_fkey1 (id, email, role)
        `)
        .eq('id', grievanceId)
        .single();

      if (grievanceError) {
        setError(`Failed to fetch grievance: ${grievanceError.message}`);
        return;
      }
      
      if (!grievanceData) {
        setError('Grievance not found. It may have been deleted or reassigned.');
        return;
      }

      const oldStatus = grievanceData.status;
      const submitterId = grievanceData.user_id;
      const submitterProfile = Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles;

      if (!submitterProfile || submitterProfile.role !== 'user') {
        setError('Submitter profile not found or not a user.');
        return;
      }

      const submitterEmail = submitterProfile.email;
      if (!submitterEmail) {
        setError('Submitter email not found. Cannot send notification.');
        return;
      }

      const { error: actionError } = await supabase
        .from('grievance_actions')
        .insert({
          grievance_id: grievanceId,
          employee_id: session.user.id,
          action_text: actionText,
        });

      if (actionError) {
        setError(`Action insert failed: ${actionError.message}`);
        return;
      }

      const { error: statusError } = await supabase
        .from('grievances')
        .update({ status: newStatus })
        .eq('id', grievanceId)
        .eq('assigned_employee_id', session.user.id);

      if (statusError) {
        setError(`Status update failed: ${statusError.message}`);
        return;
      }

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
      setError(null); // Clear any previous errors
      fetchData();
      fetchNotifications();
    } catch (error: any) {
      console.error('Error submitting action:', error);
      setError(error.message || 'Failed to submit action.');
    }
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

          {loading && (
            <p className="text-gray-600 text-lg animate-pulse text-center">Loading grievances...</p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center animate-fade-in">{error}</p>
          )}

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-30 max-h-96 overflow-y-auto">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No notifications</div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b hover:bg-gray-50 ${
                      notification.is_read ? 'opacity-75' : 'font-semibold'
                    }`}
                    onClick={() => markNotificationAsRead(notification.id)}
                  >
                    <p>{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="w-full max-w-6xl mx-auto mt-8 mb-8">
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
          </div>

          <div className="w-full max-w-6xl mx-auto">
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {loading ? (
              <div className="text-center">Loading grievances...</div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                <h2 className="text-2xl font-semibold mb-4">Assigned Grievances</h2>
                
                {grievances.length === 0 ? (
                  <div className="p-4 bg-white rounded-lg shadow-md">No grievances assigned to you.</div>
                ) : (
                  grievances.map((grievance) => (
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
                          className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300"
                        >
                          <span className="mr-2">📜</span> View Hierarchy
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
                              placeholder="Enter action taken (required)"
                              data-grievance-id={grievance.id}
                              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 ${
                                error && error.includes('Action text cannot be empty') && !actionInputs[grievance.id]?.trim()
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-300'
                              }`}
                              required
                            />
                            {error && error.includes('Action text cannot be empty') && !actionInputs[grievance.id]?.trim() && (
                              <p className="text-red-500 text-xs mt-1">Please enter details about the action taken</p>
                            )}
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
                              onClick={() => {
                                if (!actionInputs[grievance.id]?.trim()) {
                                  setError('Action text cannot be empty. Please provide details about the action taken.');
                                  return;
                                }
                                handleActionSubmit(grievance.id);
                              }}
                              className="w-full p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300"
                            >
                              Submit
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
                            <div className="overflow-y-auto border border-gray-200 rounded-lg max-h-[120px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
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
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {selectedGrievance && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-11/12 max-w-4xl p-6 relative animate-fade-in">
              <button
                onClick={closeHierarchyModal}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-all duration-200"
              >
                <span className="text-2xl">✕</span>
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
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #a0aec0;
          border-radius: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background-color: #edf2f7;
        }
      `}</style>
    </ProtectedRoute>
  );
}
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Tree from 'react-d3-tree';
import Link from 'next/link';

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

interface Grievance {
  id: number;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_employee_id?: string;
  categories: { name: string };
  profiles?: { name: string; designation: string; location: string };
  assigned_by?: { name: string; designation: string };
  hierarchy?: TreeNode;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profile, setProfile] = useState<{ id: string; category_id: number; designation: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, category_id, designation, name')
        .eq('id', sessionData.session.user.id)
        .single();

      if (profileError || !profileData) throw new Error('Profile not found.');
      setProfile(profileData);

      if (!profileData.category_id) throw new Error('Employee profile not assigned to a department.');

      const categoryId = profileData.category_id;
      const userId = sessionData.session.user.id;
      const designation = profileData.designation;

      // Fetch grievances with all delegation history
      let grievancesQuery = supabase
        .from('grievances')
        .select(`
          id,
          title,
          status,
          priority,
          created_at,
          assigned_employee_id,
          categories!category_id (name),
          profiles!grievances_assigned_employee_id_fkey (name, designation, location),
          grievance_delegations!grievance_id (
            from_employee_id,
            to_employee_id,
            from_profile:from_employee_id (name, designation),
            to_profile:to_employee_id (name, designation)
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

      // Fetch employees for delegation
      const { data: employeesData, error: employeesError } = await supabase
        .from('profiles')
        .select('id, name, designation')
        .eq('category_id', categoryId)
        .eq('role', 'employee')
        .neq('id', userId)
        .in('designation', designation === 'Lead' ? ['Senior', 'Junior'] : ['Junior']);

      if (employeesError) throw employeesError;

      // Build per-grievance hierarchy
      setGrievances(
        (grievancesData || []).map((g: any) => {
          // Initialize hierarchy with the first delegator or assigned employee
          let hierarchy: TreeNode = { name: 'Unassigned', designation: '', children: [] };
          const delegations = Array.isArray(g.grievance_delegations) ? g.grievance_delegations : [];

          if (delegations.length > 0) {
            const employeeMap = new Map<string, TreeNode>();
            // Add all employees from delegations
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

            // Build tree structure
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

            // Set root as the first delegator
            const firstDelegation = delegations[0];
            if (firstDelegation.from_employee_id) {
              hierarchy = employeeMap.get(firstDelegation.from_employee_id) || hierarchy;
            }
          } else if (g.profiles) {
            // If no delegations but assigned, show the assigned employee
            hierarchy = { name: g.profiles.name, designation: g.profiles.designation, children: [] };
          }

          return {
            ...g,
            categories: Array.isArray(g.categories) ? g.categories[0] : g.categories,
            profiles: Array.isArray(g.profiles) ? g.profiles[0] : g.profiles,
            assigned_by: delegations[0]?.from_profile
              ? { name: delegations[0].from_profile.name, designation: delegations[0].from_profile.designation }
              : undefined,
            hierarchy,
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

  const handleDelegate = async (grievanceId: number, toEmployeeId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');
      if (!['Lead', 'Senior'].includes(profile?.designation || '')) {
        throw new Error('Only Lead or Senior can delegate grievances.');
      }

      const { error: updateError } = await supabase
        .from('grievances')
        .update({ assigned_employee_id: toEmployeeId })
        .eq('id', grievanceId);

      if (updateError) throw new Error(`Grievance update failed: ${updateError.message}`);

      // Insert delegation record
      const { error: delegationError } = await supabase
        .from('grievance_delegations')
        .insert({
          grievance_id: grievanceId,
          from_employee_id: sessionData.session.user.id,
          to_employee_id: toEmployeeId,
        });

      if (delegationError) {
        console.error('Delegation insert error:', delegationError);
        throw new Error(`Delegation insert failed: ${delegationError.message}`);
      }

      // Update department_hierarchy
      const { data: toEmployee } = await supabase
        .from('profiles')
        .select('designation')
        .eq('id', toEmployeeId)
        .single();

      if (!toEmployee) throw new Error('Assignee profile not found.');

      // Use delegator's ID as parent
      const parentId = sessionData.session.user.id;
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
          { onConflict: ['employee_id', 'category_id'] }
        );

      if (hierarchyError) {
        console.error('Hierarchy upsert error:', hierarchyError);
        throw new Error(`Hierarchy upsert failed: ${hierarchyError.message}`);
      }

      alert('Grievance delegated successfully!');
      fetchData();
    } catch (error: any) {
      console.error('Error delegating grievance:', error);
      setError(error.message || 'Failed to delegate grievance.');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    router.push('/');
    router.refresh();
  };

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Employee Dashboard</h1>
          <div className="space-x-4">
            <Link
              href="/dashboard/employee/profile"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Profile
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
        <h2 className="text-2xl font-semibold mb-4">Grievance Delegation Hierarchies</h2>
        <div className="mb-6">
          {grievances.length === 0 ? (
            <p className="text-gray-600">No grievance hierarchies available.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grievances.map((grievance) => (
                <div key={grievance.id} className="bg-white p-4 rounded-lg shadow-md">
                  <h3 className="text-lg font-medium mb-2">{grievance.title}</h3>
                  <div style={{ height: '400px', width: '100%' }}>
                    <Tree
                      data={grievance.hierarchy}
                      orientation="vertical"
                      translate={{ x: 200, y: 50 }}
                      pathFunc="step"
                      nodeSize={{ x: 200, y: 100 }}
                      renderCustomNodeElement={({ nodeDatum }) => (
                        <g>
                          <circle r="15" fill="#3b82f6" />
                          <text fill="black" strokeWidth="0" x="0" y="30" textAnchor="middle">
                            {nodeDatum.name} ({nodeDatum.designation})
                          </text>
                        </g>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <h2 className="text-2xl font-semibold mb-4">Grievances</h2>
        {grievances.length === 0 ? (
          <p className="text-gray-600">No grievances assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-md">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-3 text-left">Title</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Priority</th>
                  <th className="p-3 text-left">Assigned To</th>
                  <th className="p-3 text-left">Assigned By</th>
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
                      {grievance.profiles ? `${grievance.profiles.name} (${grievance.profiles.designation})` : 'Unassigned'}
                    </td>
                    <td className="p-3">
                      {grievance.assigned_by ? `${grievance.assigned_by.name} (${grievance.assigned_by.designation})` : 'N/A'}
                    </td>
                    <td className="p-3">
                      {['Lead', 'Senior'].includes(profile?.designation || '') && (
                        <select
                          onChange={(e) => handleDelegate(grievance.id, e.target.value)}
                          className="rounded-md border-gray-300"
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
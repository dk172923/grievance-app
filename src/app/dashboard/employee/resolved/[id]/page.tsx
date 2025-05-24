'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Tree from 'react-d3-tree';
import Header from '../../../../../components/Header';
import Link from 'next/link';

interface TreeNode {
  name: string;
  designation?: string;
  children?: TreeNode[];
}

interface GrievanceAction {
  id: number;
  action_text: string;
  created_at: string;
  employee: { name: string; designation: string };
}

interface Document {
  name: string;
  url: string;
}

interface Grievance {
  id: number;
  title: string;
  description: string;
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
  ai_keywords?: string[];
  documents?: Document[];
}

export default function ResolvedGrievanceDetail() {
  const router = useRouter();
  const { id } = useParams();
  const [grievance, setGrievance] = useState<Grievance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    const fetchGrievance = async () => {
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

        const { data: grievanceData, error: grievanceError } = await supabase
          .from('grievances')
          .select(`
            id,
            title,
            description,
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
            ),
            ai_keywords
          `)
          .eq('id', id)
          .single();

        if (grievanceError) throw grievanceError;

        // Fetch documents from Supabase storage
        const { data: files, error: storageError } = await supabase.storage
          .from('grievance-documents')
          .list(`grievance-${id}`);

        if (storageError) throw storageError;

        const documents = files?.map(file => ({
          name: file.name,
          url: supabase.storage.from('grievance-documents').getPublicUrl(`grievance-${id}/${file.name}`).data.publicUrl,
        })) || [];

        let hierarchy: TreeNode = { name: 'Unassigned', designation: '', children: [] };
        const delegations = Array.isArray(grievanceData.grievance_delegations) ? grievanceData.grievance_delegations : [];

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
        } else if (grievanceData.profiles) {
          hierarchy = { name: grievanceData.profiles.name, designation: grievanceData.profiles.designation, children: [] };
        }

        const actions = Array.isArray(grievanceData.grievance_actions)
          ? grievanceData.grievance_actions
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

        setGrievance({
          ...grievanceData,
          categories: Array.isArray(grievanceData.categories) ? grievanceData.categories[0] : grievanceData.categories,
          profiles: Array.isArray(grievanceData.profiles) ? grievanceData.profiles[0] : grievanceData.profiles,
          submitter: Array.isArray(grievanceData.submitter) ? grievanceData.submitter[0] : grievanceData.submitter,
          assigned_by: delegations[0]?.from_profile
            ? { name: delegations[0].from_profile.name, designation: delegations[0].from_profile.designation }
            : undefined,
          hierarchy,
          actions,
          ai_keywords: grievanceData.ai_keywords || [],
          documents,
        });

        fetchRecommendations(grievanceData);
      } catch (error: any) {
        console.error('Error fetching grievance:', error);
        setError(error.message || 'Failed to load grievance.');
      } finally {
        setLoading(false);
      }
    };

    fetchGrievance();
  }, [id]);

  const fetchRecommendations = async (grievance: any) => {
    setRecLoading(true);
    try {
      let query = supabase
        .from('grievances')
        .select(`id, title, description, translated_text, ai_keywords, status, priority, created_at, grievance_actions!grievance_id (action_text, created_at)`)
        .neq('id', id)
        .eq('category_id', grievance.categories.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data, error } = await query;
      if (error) throw error;

      const currentKeywords = (grievance.ai_keywords || []).map((k: string) => k.toLowerCase());
      const scored = (data || []).map((g: any) => {
        const gKeywords = (g.ai_keywords || []).map((k: string) => k.toLowerCase());
        const overlap = currentKeywords.filter((k: string) => gKeywords.includes(k)).length;
        const textA = (grievance.translated_text || grievance.description || '').toLowerCase();
        const textB = (g.translated_text || g.description || '').toLowerCase();
        const setA = new Set(textA.split(/\W+/));
        const setB = new Set(textB.split(/\W+/));
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        const jaccard = union.size ? intersection.size / union.size : 0;
        return { ...g, overlap, jaccard };
      });

      scored.sort((a, b) => b.overlap - a.overlap || b.jaccard - a.jaccard);
      setRecommendations(scored.slice(0, 5));
    } catch (err) {
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute role="employee">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
          <Header role="employee" />
          <p className="text-gray-600 text-lg animate-pulse text-center mt-8">Loading grievance...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !grievance) {
    return (
      <ProtectedRoute role="employee">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
          <Header role="employee" />
          <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center mt-8 animate-fade-in">
            {error || 'Grievance not found.'}
          </p>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="employee" />
        <div className="max-w-4xl mx-auto p-8">
          <Link
            href="/dashboard/employee/resolved"
            className="inline-block mb-6 text-indigo-600 hover:text-indigo-800 transition-all duration-300"
          >
            ← Back to Resolved Grievances
          </Link>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-3xl font-semibold text-gray-800 mb-4">{grievance.title}</h1>
            <div className="space-y-4">
              <div>
                <span className="font-medium text-gray-600">Description:</span>
                <p className="text-gray-800 mt-1">{grievance.description || 'No description provided.'}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Category:</span>
                <span className="text-gray-800">{grievance.categories.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    grievance.status === 'Resolved'
                      ? 'bg-green-100 text-green-800'
                      : grievance.status === 'Closed'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {grievance.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Priority:</span>
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
                <span className="font-medium text-gray-600">Assigned To:</span>
                <span className="text-gray-800">
                  {grievance.profiles
                    ? `${grievance.profiles.name} (${grievance.profiles.designation})`
                    : 'Unassigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-600">Assigned By:</span>
                <span className="text-gray-800">
                  {grievance.assigned_by
                    ? `${grievance.assigned_by.name} (${grievance.assigned_by.designation})`
                    : 'N/A'}
                </span>
              </div>
              {grievance.documents && grievance.documents.length > 0 && (
                <div>
                  <span className="font-medium text-gray-600">Uploaded Documents:</span>
                  <ul className="list-disc ml-6 mt-1">
                    {grievance.documents.map((doc, idx) => (
                      <li key={idx}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          {doc.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Delegation Hierarchy</h3>
              <div className="border border-gray-200 rounded-lg p-4" style={{ height: '400px', width: '100%' }}>
                <Tree
                  data={grievance.hierarchy}
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

            {grievance.actions && grievance.actions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Action History</h3>
                <div className="overflow-y-auto border border-gray-200 rounded-lg max-h-[200px] scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
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
                          <td className="p-3">{new Date(action.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Suggested Actions</h3>
              {recLoading ? (
                <p className="text-gray-600 text-sm animate-pulse">Loading recommendations...</p>
              ) : recommendations.length === 0 ? (
                <p className="text-gray-600 text-sm">No similar grievances found for recommendations.</p>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="mb-1">
                        <span className="font-semibold text-gray-700 text-sm">{rec.title}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          ({new Date(rec.created_at).toLocaleDateString()})
                        </span>
                      </div>
                      <div className="mb-1 text-xs text-gray-600">
                        {rec.translated_text || rec.description}
                      </div>
                      <div className="mb-1 text-xs">
                        <span className="font-medium text-gray-700">Status:</span> {rec.status} |{' '}
                        <span className="font-medium text-gray-700">Priority:</span> {rec.priority}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 text-xs">Actions Taken:</span>
                        {rec.grievance_actions && rec.grievance_actions.length > 0 ? (
                          <ul className="list-disc ml-4 text-xs text-gray-700">
                            {rec.grievance_actions.map((a: any, idx: number) => (
                              <li key={idx}>
                                {a.action_text}{' '}
                                <span className="text-xs text-gray-400">
                                  ({new Date(a.created_at).toLocaleDateString()})
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ml-2 text-gray-500 text-xs">No actions recorded.</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <span className="font-semibold text-indigo-700 text-sm">Suggested Actions:</span>
                    <ul className="list-disc ml-4 text-indigo-700 text-xs">
                      {(() => {
                        const allActions = recommendations.flatMap((r: any) =>
                          (r.grievance_actions || []).map((a: any) => a.action_text)
                        );
                        const freq: Record<string, number> = {};
                        allActions.forEach((a: string) => {
                          freq[a] = (freq[a] || 0) + 1;
                        });
                        return Object.entries(freq)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([action, count], idx) => (
                            <li key={idx}>
                              {action} <span className="text-xs">({count} times)</span>
                            </li>
                          ));
                      })()}
                    </ul>
                  </div>
                </div>
              )}
            </div>
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
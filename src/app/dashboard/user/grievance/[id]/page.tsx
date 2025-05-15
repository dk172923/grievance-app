'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../../../components/Header';
import { translateTamilToEnglish } from '../../../../../lib/ai-utils';

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
  categories: { id: number; name: string };
  profiles?: { name: string; designation: string; location: string };
  actions?: GrievanceAction[];
  language: string;
  translated_text?: string;
  ai_keywords?: string[];
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
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchGrievance();
    }
  }, [id]);

  useEffect(() => {
    if (grievance && grievance.language === 'Tamil') {
      handleTranslation();
    }
  }, [grievance]);

  useEffect(() => {
    if (grievance) {
      fetchRecommendations();
    }
  }, [grievance]);

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
          category_id,
          ai_keywords,
          categories!category_id (id, name),
          profiles:assigned_employee_id (name, designation, location),
          grievance_actions!grievance_id (
            id,
            action_text,
            created_at,
            employee:profiles!grievance_actions_employee_id_fkey (name, designation)
          ),
          language,
          translated_text
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
        ai_keywords: grievanceData.ai_keywords || [],
      };

      // Normalize delegations: use first element of from_employee/to_employee arrays
      const normalizedDelegations = (delegationData || []).map((d: any) => ({
        ...d,
        from_employee: Array.isArray(d.from_employee) ? d.from_employee[0] : d.from_employee,
        to_employee: Array.isArray(d.to_employee) ? d.to_employee[0] : d.to_employee,
      }));

      setGrievance(normalizedGrievance as Grievance);
      setDelegations(normalizedDelegations as Delegation[]);
    } catch (error: any) {
      console.error('Error fetching grievance:', error);
      setError(error.message || 'Failed to load grievance details.');
    } finally {
      setLoading(false);
    }
  };

  const handleTranslation = async () => {
    if (!grievance) return;
    if (grievance.translated_text) {
      setTranslatedText(grievance.translated_text);
      return;
    }
    setTranslating(true);
    try {
      const textToTranslate = grievance.description;
      const translation = await translateTamilToEnglish(textToTranslate);
      setTranslatedText(translation);
      // Update DB with translation
      await supabase.from('grievances').update({ translated_text: translation }).eq('id', grievance.id);
    } catch (err) {
      setTranslatedText('Translation failed.');
    } finally {
      setTranslating(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!grievance) return;
    setRecLoading(true);
    try {
      // Fetch similar grievances by category
      let query = supabase
        .from('grievances')
        .select(`id, title, description, translated_text, ai_keywords, status, priority, created_at, grievance_actions!grievance_id (action_text, created_at)`)
        .neq('id', grievance.id)
        .eq('category_id', grievance.categories.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const { data, error } = await query;
      if (error) throw error;
      // Simple keyword overlap ranking
      const currentKeywords = (grievance.ai_keywords || []).map((k: string) => k.toLowerCase());
      const scored = (data || []).map((g: any) => {
        const gKeywords = (g.ai_keywords || []).map((k: string) => k.toLowerCase());
        const overlap = currentKeywords.filter((k: string) => gKeywords.includes(k)).length;
        // Simple text similarity (Jaccard)
        const textA = (grievance.translated_text || grievance.description || '').toLowerCase();
        const textB = (g.translated_text || g.description || '').toLowerCase();
        const setA = new Set(textA.split(/\W+/));
        const setB = new Set(textB.split(/\W+/));
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        const jaccard = union.size ? intersection.size / union.size : 0;
        return { ...g, overlap, jaccard };
      });
      // Sort by overlap, then jaccard
      scored.sort((a, b) => b.overlap - a.overlap || b.jaccard - a.jaccard);
      setRecommendations(scored.slice(0, 5));
    } catch (err) {
      setRecommendations([]);
    } finally {
      setRecLoading(false);
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
                    <strong className="text-gray-900">Description:</strong>
                    {grievance.language === 'Tamil' && (
                      <>
                        <button
                          className="ml-4 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          onClick={() => setShowTranslation((prev) => !prev)}
                          disabled={translating}
                        >
                          {showTranslation ? 'Show Original' : 'Show Translation'}
                        </button>
                        {translating && <span className="ml-2 text-xs text-gray-500">Translating...</span>}
                      </>
                    )}
                    <br />
                    {showTranslation && translatedText
                      ? <span className="block mt-2 text-blue-800">{translatedText}</span>
                      : <span className="block mt-2">{grievance.description}</span>}
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
          <h2 className="text-3xl font-semibold text-gray-800 mb-6 animate-fade-in">Recommended Actions</h2>
          {recLoading ? (
            <p className="text-gray-600 bg-white p-6 rounded-lg shadow-md animate-fade-in">Loading recommendations...</p>
          ) : recommendations.length === 0 ? (
            <p className="text-gray-600 bg-white p-6 rounded-lg shadow-md animate-fade-in">No similar grievances found for recommendations.</p>
          ) : (
            <div className="space-y-6 mb-8">
              {recommendations.map((rec) => (
                <div key={rec.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="mb-2">
                    <span className="font-semibold text-gray-700">{rec.title}</span>
                    <span className="ml-2 text-xs text-gray-500">({new Date(rec.created_at).toLocaleDateString()})</span>
                  </div>
                  <div className="mb-2 text-sm text-gray-600">{rec.translated_text || rec.description}</div>
                  <div className="mb-2">
                    <span className="font-medium text-gray-700">Status:</span> {rec.status} | <span className="font-medium text-gray-700">Priority:</span> {rec.priority}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Actions Taken:</span>
                    {rec.grievance_actions && rec.grievance_actions.length > 0 ? (
                      <ul className="list-disc ml-6 text-sm text-gray-700">
                        {rec.grievance_actions.map((a: any, idx: number) => (
                          <li key={idx}>{a.action_text} <span className="text-xs text-gray-400">({new Date(a.created_at).toLocaleDateString()})</span></li>
                        ))}
                      </ul>
                    ) : (
                      <span className="ml-2 text-gray-500">No actions recorded.</span>
                    )}
                  </div>
                </div>
              ))}
              {/* Suggest most common actions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <span className="font-semibold text-blue-700">Suggested Actions:</span>
                <ul className="list-disc ml-6 text-blue-700">
                  {(() => {
                    // Aggregate actions from recommendations
                    const allActions = recommendations.flatMap(r => (r.grievance_actions || []).map((a: any) => a.action_text));
                    const freq: Record<string, number> = {};
                    allActions.forEach(a => { freq[a] = (freq[a] || 0) + 1; });
                    return Object.entries(freq)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([action, count], idx) => (
                        <li key={idx}>{action} <span className="text-xs">({count} times)</span></li>
                      ));
                  })()}
                </ul>
              </div>
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
'use client';
import { useEffect, useState } from 'react';
import { kmeans } from 'ml-kmeans';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

// Interfaces for type safety
interface Grievance {
  id: number;
  title: string;
  location: string;
  category_id: number;
  categories: { name: string };
  ai_keywords: string[];
  created_at: string;
  priority: string;
  cluster?: number;
}

interface ClusterSummary {
  cluster: number;
  count: number;
  topAreas: { name: string; count: number }[];
  topCategories: { name: string; count: number }[];
  topKeywords: { name: string; count: number }[];
  highPriorityCount: number;
  monthlyTrends: { month: string; count: number }[];
}

interface ScatterPoint {
  x: number;
  y: number;
  area: string;
  category: string;
  cluster: number;
  title: string;
}

// Helper function for one-hot encoding
function oneHotEncode(items: string[], allItems: string[]): number[] {
  return allItems.map(item => (items.includes(item) ? 1 : 0));
}

// Helper function to get top N items from frequency map
function getTopN(freq: Record<string, number>, n: number): { name: string; count: number }[] {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

// Helper function to compute monthly trends (last 12 months)
function computeMonthlyTrends(grievances: Grievance[]): { month: string; count: number }[] {
  const trends: Record<string, number> = {};
  const today = new Date('2025-05-25'); // Hardcoded for context; replace with new Date() in production
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
    trends[monthKey] = 0;
  }
  grievances.forEach(g => {
    const month = g.created_at.slice(0, 7);
    if (trends[month] !== undefined) {
      trends[month]++;
    }
  });
  return Object.entries(trends).map(([month, count]) => ({ month, count }));
}

export default function ProblemHotspots() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [k, setK] = useState(3);
  const [clusters, setClusters] = useState<Grievance[]>([]);
  const [clusterSummaries, setClusterSummaries] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allAreas, setAllAreas] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allKeywords, setAllKeywords] = useState<string[]>([]);
  const [expandedClusters, setExpandedClusters] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchGrievances();
  }, []);

  useEffect(() => {
    if (grievances.length > 0) {
      runClustering();
    }
  }, [grievances, k]);

  async function fetchGrievances() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('grievances')
        .select('id, title, location, category_id, ai_keywords, created_at, priority, categories!category_id (name)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const areas = Array.from(new Set(data.map((g: Grievance) => g.location)));
      const categories = Array.from(new Set(data.map((g: Grievance) => g.categories?.name || 'Unknown')));
      const keywords = Array.from(new Set(data.flatMap((g: Grievance) => g.ai_keywords || [])));

      setAllAreas(areas);
      setAllCategories(categories);
      setAllKeywords(keywords);
      setGrievances(data);
    } catch (error: any) {
      console.error('Error fetching grievances:', error);
      setError('Failed to load grievances. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function runClustering() {
    if (grievances.length < k) {
      setError(`Not enough grievances (${grievances.length}) for ${k} clusters.`);
      return;
    }

    try {
      // Prepare features: [area one-hot, category one-hot, keyword one-hot]
      const features = grievances.map(g => [
        ...oneHotEncode([g.location], allAreas),
        ...oneHotEncode([g.categories?.name || 'Unknown'], allCategories),
        ...oneHotEncode(g.ai_keywords || [], allKeywords),
      ]);

      // Run K-means clustering
      const result = kmeans(features, k, { seed: 42 });
      const clustered = grievances.map((g, i) => ({ ...g, cluster: result.clusters[i] }));
      setClusters(clustered);

      // Summarize clusters
      const summaries = Array.from({ length: k }, (_, idx) => {
        const group = clustered.filter(g => g.cluster === idx);
        const areaFreq: Record<string, number> = {};
        const catFreq: Record<string, number> = {};
        const kwFreq: Record<string, number> = {};
        let highPriorityCount = 0;

        group.forEach(g => {
          areaFreq[g.location] = (areaFreq[g.location] || 0) + 1;
          const cat = g.categories?.name || 'Unknown';
          catFreq[cat] = (catFreq[cat] || 0) + 1;
          (g.ai_keywords || []).forEach((kw: string) => {
            kwFreq[kw] = (kwFreq[kw] || 0) + 1;
          });
          if (g.priority === 'High') highPriorityCount++;
        });

        return {
          cluster: idx,
          count: group.length,
          topAreas: getTopN(areaFreq, 3),
          topCategories: getTopN(catFreq, 3),
          topKeywords: getTopN(kwFreq, 3),
          highPriorityCount,
          monthlyTrends: computeMonthlyTrends(group),
        };
      });

      setClusterSummaries(summaries);
    } catch (error) {
      console.error('Error running K-means clustering:', error);
      setError('Failed to cluster grievances. Please try a different number of clusters.');
    }
  }

  // Prepare scatter plot data
  const scatterData: ScatterPoint[] = clusters.map(g => ({
    x: allAreas.indexOf(g.location),
    y: allCategories.indexOf(g.categories?.name || 'Unknown'),
    area: g.location,
    category: g.categories?.name || 'Unknown',
    cluster: g.cluster || 0,
    title: g.title,
  }));

  // Toggle cluster expansion
  const toggleCluster = (cluster: number) => {
    setExpandedClusters(prev =>
      prev.includes(cluster) ? prev.filter(c => c !== cluster) : [...prev, cluster]
    );
  };

  // Filter grievances by search term
  const filteredClusters = clusters.filter(g =>
    g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.categories?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.ai_keywords?.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center animate-fade-in-down">
          Grievance Hotspots Analysis
        </h1>
        <p className="text-lg text-gray-600 mb-8 text-center animate-fade-in-up">
          Identify patterns in grievances using K-means clustering to prioritize areas and issues.
        </p>

        {error && (
          <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-lg text-center animate-fade-in">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
            <label htmlFor="k-select" className="text-lg font-medium text-gray-700 mr-4">
              Number of Clusters (k):
            </label>
            <select
              id="k-select"
              value={k}
              onChange={e => setK(Number(e.target.value))}
              className="mt-2 sm:mt-0 w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 80, left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Area"
                  tickFormatter={idx => allAreas[idx] || ''}
                  allowDecimals={false}
                  tick={{ angle: -45, textAnchor: 'end', fontSize: 12 }}
                  interval={0}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Category"
                  tickFormatter={idx => allCategories[idx] || ''}
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-800">{data.title}</p>
                          <p className="text-sm text-gray-600">Area: {data.area}</p>
                          <p className="text-sm text-gray-600">Category: {data.category}</p>
                          <p className="text-sm text-gray-600">Cluster: {data.cluster + 1}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                {[...Array(k)].map((_, idx) => (
                  <Scatter
                    key={idx}
                    name={`Cluster ${idx + 1}`}
                    data={scatterData.filter(d => d.cluster === idx)}
                    fill={`hsl(${(idx * 360) / k}, 70%, 50%)`}
                    shape="circle"
                    opacity={0.8}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Cluster Summaries</h2>
          {clusterSummaries.length === 0 ? (
            <p className="text-gray-600">No clusters available. Try adjusting the number of clusters.</p>
          ) : (
            <div className="space-y-6">
              {clusterSummaries.map(summary => (
                <div key={summary.cluster} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleCluster(summary.cluster)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-all duration-200"
                  >
                    <h3 className="text-lg font-bold text-gray-800">
                      Cluster {summary.cluster + 1} ({summary.count} Grievances)
                    </h3>
                    {expandedClusters.includes(summary.cluster) ? (
                      <ChevronUpIcon className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </button>
                  {expandedClusters.includes(summary.cluster) && (
                    <div className="p-4 space-y-4 animate-fade-in">
                      <div>
                        <p><strong>High-Priority Grievances:</strong> {summary.highPriorityCount}</p>
                        <p><strong>Top Areas:</strong></p>
                        <ul className="list-disc ml-6">
                          {summary.topAreas.map(area => (
                            <li key={area.name}>
                              {area.name} ({area.count})
                            </li>
                          ))}
                        </ul>
                        <p><strong>Top Categories:</strong></p>
                        <ul className="list-disc ml-6">
                          {summary.topCategories.map(cat => (
                            <li key={cat.name}>
                              {cat.name} ({cat.count})
                            </li>
                          ))}
                        </ul>
                        <p><strong>Top Keywords:</strong></p>
                        <ul className="list-disc ml-6">
                          {summary.topKeywords.map(kw => (
                            <li key={kw.name}>
                              {kw.name} ({kw.count})
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">Monthly Trends (Last 12 Months)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-gray-600">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="p-2 text-left">Month</th>
                                <th className="p-2 text-left">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {summary.monthlyTrends.map(trend => (
                                <tr key={trend.month} className="border-t">
                                  <td className="p-2">{trend.month}</td>
                                  <td className="p-2">{trend.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Grievance Details</h2>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search grievances by title, area, category, or keyword..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
            />
          </div>
          {filteredClusters.length === 0 ? (
            <p className="text-gray-600">No grievances match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-600">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left">Cluster</th>
                    <th className="p-3 text-left">Title</th>
                    <th className="p-3 text-left">Area</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Priority</th>
                    <th className="p-3 text-left">Keywords</th>
                    <th className="p-3 text-left">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClusters.map(g => (
                    <tr key={g.id} className="border-t hover:bg-gray-50 transition-all duration-200">
                      <td className="p-3">{g.cluster !== undefined ? g.cluster + 1 : '-'}</td>
                      <td className="p-3">
                        <Link
                          href={`/dashboard/employee/grievance/${g.id}`}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          {g.title}
                        </Link>
                      </td>
                      <td className="p-3">{g.location}</td>
                      <td className="p-3">{g.categories?.name || 'Unknown'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            g.priority === 'High'
                              ? 'bg-red-100 text-red-800'
                              : g.priority === 'Medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {g.priority}
                        </span>
                      </td>
                      <td className="p-3">{g.ai_keywords?.join(', ') || '-'}</td>
                      <td className="p-3">{new Date(g.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          animation: fadeInDown 0.5s ease-out;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }
        .animate-fade-in {
          animation: fadeInDown 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
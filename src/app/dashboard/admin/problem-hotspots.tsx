import { useEffect, useState } from 'react';
import { kmeans } from 'ml-kmeans';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../../../lib/supabase';

// Helper functions for encoding
function oneHotEncode(items: string[], allItems: string[]) {
  return allItems.map(item => (items.includes(item) ? 1 : 0));
}

export default function ProblemHotspots() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [k, setK] = useState(3);
  const [clusters, setClusters] = useState<any[]>([]);
  const [clusterSummaries, setClusterSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [allAreas, setAllAreas] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allKeywords, setAllKeywords] = useState<string[]>([]);

  useEffect(() => {
    fetchGrievances();
  }, []);

  useEffect(() => {
    if (grievances.length > 0) {
      runClustering();
    }
    // eslint-disable-next-line
  }, [grievances, k]);

  async function fetchGrievances() {
    setLoading(true);
    const { data, error } = await supabase
      .from('grievances')
      .select('id, location, category_id, ai_keywords, categories!category_id (name)');
    if (error) {
      setLoading(false);
      return;
    }
    // Gather all unique areas, categories, and keywords
    const areas = Array.from(new Set(data.map((g: any) => g.location)));
    const categories = Array.from(new Set(data.map((g: any) => g.categories?.name || 'Unknown')));
    const keywords = Array.from(new Set(data.flatMap((g: any) => g.ai_keywords || [])));
    setAllAreas(areas);
    setAllCategories(categories);
    setAllKeywords(keywords);
    setGrievances(data);
    setLoading(false);
  }

  function runClustering() {
    // Prepare features: [area one-hot, category one-hot, keyword one-hot]
    const features = grievances.map(g => [
      ...oneHotEncode([g.location], allAreas),
      ...oneHotEncode([g.categories?.name || 'Unknown'], allCategories),
      ...oneHotEncode(g.ai_keywords || [], allKeywords)
    ]);
    
    if (features.length < k) return;
    
    try {
      // Using the kmeans function from ml-kmeans v6.0.0
      const result = kmeans(features, k, { seed: 42 });
      
      // Assign cluster to each grievance
      const clustered = grievances.map((g, i) => ({ ...g, cluster: result.clusters[i] }));
      setClusters(clustered);
      
      // Summarize clusters
      const summaries = Array.from({ length: k }, (_, idx) => {
        const group = clustered.filter(g => g.cluster === idx);
        const areaFreq: Record<string, number> = {};
        const catFreq: Record<string, number> = {};
        const kwFreq: Record<string, number> = {};
        group.forEach(g => {
          areaFreq[g.location] = (areaFreq[g.location] || 0) + 1;
          const cat = g.categories?.name || 'Unknown';
          catFreq[cat] = (catFreq[cat] || 0) + 1;
          (g.ai_keywords || []).forEach((kw: string) => {
            kwFreq[kw] = (kwFreq[kw] || 0) + 1;
          });
        });
        const mostCommon = (freq: Record<string, number>) => Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
        return {
          cluster: idx,
          count: group.length,
          mostCommonArea: mostCommon(areaFreq),
          mostCommonCategory: mostCommon(catFreq),
          mostCommonKeyword: mostCommon(kwFreq)
        };
      });
      setClusterSummaries(summaries);
    } catch (error) {
      console.error("Error running K-means clustering:", error);
    }
  }

  // Prepare data for scatter plot
  const scatterData = clusters.map(g => ({
    x: allAreas.indexOf(g.location),
    y: allCategories.indexOf(g.categories?.name || 'Unknown'),
    area: g.location,
    category: g.categories?.name || 'Unknown',
    cluster: g.cluster
  }));

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Problem Hotspots (K-means Clustering)</h1>
      <div className="mb-4 flex items-center space-x-4">
        <label htmlFor="k-select" className="font-medium">Number of Clusters (k):</label>
        <select
          id="k-select"
          value={k}
          onChange={e => setK(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p>Loading grievances...</p>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis
              type="number"
              dataKey="x"
              name="Area"
              tickFormatter={idx => allAreas[idx] || ''}
              allowDecimals={false}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Category"
              tickFormatter={idx => allCategories[idx] || ''}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value, name, props) => {
                if (name === 'x') return [allAreas[value as number], 'Area'];
                if (name === 'y') return [allCategories[value as number], 'Category'];
                return [value, name];
              }}
            />
            <Legend />
            {[...Array(k)].map((_, idx) => (
              <Scatter
                key={idx}
                name={`Cluster ${idx + 1}`}
                data={scatterData.filter(d => d.cluster === idx)}
                fill={`hsl(${(idx * 360) / k}, 70%, 50%)`}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      )}
      <h2 className="text-2xl font-semibold mt-8 mb-4">Cluster Summaries</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {clusterSummaries.map(s => (
          <div key={s.cluster} className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold text-lg mb-2">Cluster {s.cluster + 1}</h3>
            <p><strong>Number of Grievances:</strong> {s.count}</p>
            <p><strong>Most Common Area:</strong> {s.mostCommonArea}</p>
            <p><strong>Most Common Category:</strong> {s.mostCommonCategory}</p>
            <p><strong>Most Common Keyword:</strong> {s.mostCommonKeyword}</p>
          </div>
        ))}
      </div>
    </div>
  );
} 
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../../components/Header';

export default function EmployeeProfile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    category_id: 0,
    designation: 'Junior' as 'Lead' | 'Senior' | 'Junior',
    location: '',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileAndCategories();
  }, []);

  const fetchProfileAndCategories = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, category_id, designation, location')
        .eq('id', sessionData.session.user.id)
        .single();
      if (profileError) throw profileError;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (categoriesError) throw categoriesError;

      setProfile(profileData);
      setCategories(categoriesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          category_id: profile.category_id,
          designation: profile.designation,
          location: profile.location,
        })
        .eq('id', sessionData.session.user.id);

      if (error) throw error;
      setSuccess('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile.');
    }
  };

  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="employee" />
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-800 animate-fade-in-down">
              Edit Your Profile
            </h2>
            <p className="mt-4 text-lg text-gray-600 animate-fade-in-up">
              Update your details to keep your profile current.
            </p>
          </div>
          {loading && (
            <p className="text-gray-600 text-lg animate-pulse text-center">Loading profile...</p>
          )}
          {error && (
            <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 shadow-inner text-center animate-fade-in">{error}</p>
          )}
          {success && (
            <p className="text-green-600 bg-green-100 p-4 rounded-lg mb-6 shadow-inner text-center animate-fade-in">{success}</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-lg animate-fade-in">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="name"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 cursor-not-allowed p-3"
                value={profile.email}
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <select
                id="category"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.category_id}
                onChange={(e) => setProfile({ ...profile, category_id: Number(e.target.value) })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="designation" className="block text-sm font-medium text-gray-700">
                Designation
              </label>
              <select
                id="designation"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.designation}
                onChange={(e) => setProfile({ ...profile, designation: e.target.value as 'Lead' | 'Senior' | 'Junior' })}
              >
                <option value="Lead">Lead</option>
                <option value="Senior">Senior</option>
                <option value="Junior">Junior</option>
              </select>
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                id="location"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              />
            </div>
            <div className="flex justify-center space-x-4">
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 shadow-md"
              >
                Save Changes
              </button>
              <Link
                href="/dashboard/employee"
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-300 shadow-md"
              >
                Cancel
              </Link>
            </div>
          </form>
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
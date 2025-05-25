'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../../components/Header';

export default function UserProfile() {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, email, phone_number, address')
        .eq('id', sessionData.session.user.id)
        .single();
      if (profileError) throw profileError;

      // Normalize null values to empty strings
      setProfile({
        name: profileData.name ?? '',
        email: profileData.email ?? '',
        phone_number: profileData.phone_number ?? '',
        address: profileData.address ?? '',
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
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
          phone_number: profile.phone_number,
          address: profile.address,
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
    <ProtectedRoute role="user">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="user" />
        <div className="max-w-2xl mx-auto p-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-800 animate-fade-in-down">
              Your Profile
            </h2>
            <p className="mt-4 text-lg text-gray-600 animate-fade-in-up">
              View and update your contact details.
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
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 cursor-not-allowed p-3"
                value={profile.name}
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
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone_number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.phone_number}
                onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                id="address"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 p-3"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
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
                href="/dashboard/user"
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
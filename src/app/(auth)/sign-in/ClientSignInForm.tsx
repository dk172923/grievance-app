'use client';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ClientSignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'user') window.location.href = '/dashboard/user';
      else if (profile?.role === 'employee') window.location.href = '/dashboard/employee';
      else if (profile?.role === 'admin') window.location.href = '/dashboard/admin';
      else window.location.href = '/';
    }
  };

  return (
    <>
      <style jsx>{`
        .fade-in {
          animation: fadeIn 1s ease-in-out;
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 fade-in">
        <div className="bg-white p-10 rounded-xl shadow-lg w-full max-w-md transform hover:scale-105 transition-all duration-300">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-800 tracking-tight">
            Sign In
          </h2>
          <form onSubmit={handleSignIn}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 font-semibold shadow-md"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
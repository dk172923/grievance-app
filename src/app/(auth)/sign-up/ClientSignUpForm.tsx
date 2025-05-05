'use client';
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function ClientSignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        role: role,
        email: data.user.email,
        name: name || 'Unknown',
      });

      if (profileError) {
        setError('Failed to create profile: ' + profileError.message);
        return;
      }

      window.location.href = `/dashboard/${role}`;
    } else {
      setError('User creation failed.');
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
            Sign Up
          </h2>
          <form onSubmit={handleSignUp}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>
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
            <div className="mb-6">
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
            <div className="mb-8">
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Role
              </label>
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="user"
                    checked={role === 'user'}
                    onChange={(e) => setRole(e.target.value)}
                    className="mr-2 accent-blue-600"
                    required
                  />
                  <span className="text-gray-700 font-medium">User</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="employee"
                    checked={role === 'employee'}
                    onChange={(e) => setRole(e.target.value)}
                    className="mr-2 accent-blue-600"
                    required
                  />
                  <span className="text-gray-700 font-medium">Employee</span>
                </label>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 font-semibold shadow-md"
            >
              Sign Up
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
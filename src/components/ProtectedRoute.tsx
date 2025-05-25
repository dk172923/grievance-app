'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  role: 'user' | 'employee' | 'admin';
  children: React.ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) {
          router.push('/sign-in');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, banned')
          .eq('id', session.user.id)
          .single();
        if (profileError) throw profileError;

        if (profile?.banned || profile?.role !== role) {
          router.push('/sign-in');
          return;
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Auth check error:', err);
        setError('Failed to verify access. Redirecting...');
        setTimeout(() => router.push('/sign-in'), 2000);
      }
    }

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/sign-in');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, role]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function EmployeeOrAdminRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        router.refresh();
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // Allow both employee and admin roles to access
      if (profile?.role !== 'employee' && profile?.role !== 'admin') {
        router.push('/sign-in');
        router.refresh();
      }

      setIsLoading(false);
    };

    checkUser();

    // Auto-logout listener removed to prevent automatic sign-outs
  }, [router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>;
  }

  return <>{children}</>;
} 
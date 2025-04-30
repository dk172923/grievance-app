import { supabase } from '../lib/supabase';
import './globals.css';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Grievance Management System',
  description: 'A system to submit and track grievances',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      console.error('Profile fetch error:', error?.message || 'No profile found');
      const { error: insertError } = await supabase.from('profiles').insert({
        id: session.user.id,
        role: 'user',
        email: session.user.email,
        name: 'Unknown',
      });

      if (insertError) {
        console.error('Failed to create profile:', insertError.message);
        redirect('/sign-in');
      }
      redirect('/dashboard/user');
    }

    // Redirect authenticated users to their dashboard
    redirect(`/dashboard/${profile.role}`);
  } else {
    // Redirect unauthenticated users from dashboard routes
    const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;
    if (currentPath.startsWith('/dashboard')) {
      redirect('/sign-in');
    }
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        {children}
      </body>
    </html>
  );
}
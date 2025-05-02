'use server';
import { supabase } from '../../../lib/supabase';
import { redirect } from 'next/navigation';
import ClientSignInForm from './ClientSignInForm';

export default async function SignIn() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      console.error('Profile fetch error:', error?.message || 'No profile found');
      return <ClientSignInForm />;
    }

    if (profile.role === 'user') redirect('/dashboard/user');
    else if (profile.role === 'employee') redirect('/dashboard/employee');
    else if (profile.role === 'admin') redirect('/dashboard/admin');
  }

  return <ClientSignInForm />;
}
import { supabase } from '../../../lib/supabase';
import { redirect } from 'next/navigation';
import ClientSignInForm from './ClientSignInForm';

export default async function SignIn() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role === 'user') redirect('/dashboard/user');
    if (profile?.role === 'employee') redirect('/dashboard/employee');
    if (profile?.role === 'admin') redirect('/dashboard/admin');
  }

  return <ClientSignInForm />;
}
'use client';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import AIAssistant with no SSR to avoid hydration issues
const AIAssistant = dynamic(() => import('@/components/AIAssistant'), {
  ssr: false,
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Determine user role from URL path
  let userRole: 'user' | 'employee' | 'admin' = 'user';
  
  if (pathname?.includes('/dashboard/admin')) {
    userRole = 'admin';
  } else if (pathname?.includes('/dashboard/employee')) {
    userRole = 'employee';
  }

  return (
    <>
      {children}
      <AIAssistant userRole={userRole} />
    </>
  );
} 
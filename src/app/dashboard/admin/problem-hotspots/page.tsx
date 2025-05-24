'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import EmployeeOrAdminRoute from '../../../../components/EmployeeOrAdminRoute';
import ProblemHotspots from '../problem-hotspots';
import Header from '../../../../components/Header';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../../../lib/supabase';

export default function ProblemHotspotsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'admin' | 'employee'>('employee');
  
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        if (profile && (profile.role === 'admin' || profile.role === 'employee')) {
          setUserRole(profile.role as 'admin' | 'employee');
        }
      }
    };
    
    fetchUserRole();
  }, []);
  
  const handleBackClick = () => {
    if (userRole === 'admin') {
      router.push('/dashboard/admin');
    } else {
      router.push('/dashboard/employee');
    }
  };
  
  return (
    <EmployeeOrAdminRoute>
      <div className="min-h-screen bg-gray-100">
        <Header role={userRole} />
        
        <div className="max-w-6xl mx-auto pt-8 px-4">
          <button 
            onClick={handleBackClick} 
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 mb-6"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          
          <ProblemHotspots />
        </div>
      </div>
    </EmployeeOrAdminRoute>
  );
} 
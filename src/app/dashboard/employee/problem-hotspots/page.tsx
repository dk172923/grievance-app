'use client';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import ProblemHotspots from '../../admin/problem-hotspots';
import Header from '../../../../components/Header';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function EmployeeProblemHotspotsPage() {
  const router = useRouter();
  
  return (
    <ProtectedRoute role="employee">
      <div className="min-h-screen bg-gray-100">
        <Header role="employee" />
        
        <div className="max-w-6xl mx-auto pt-8 px-4">
          <button 
            onClick={() => router.push('/dashboard/employee')} 
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all duration-300 mb-6"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Employee Dashboard
          </button>
          
          <ProblemHotspots />
        </div>
      </div>
    </ProtectedRoute>
  );
} 
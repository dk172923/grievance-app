'use client';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Link from 'next/link';
import Header from '../../../components/Header';

export default function UserDashboard() {
  return (
    <ProtectedRoute role="user">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="user" />
        <div className="max-w-7xl mx-auto p-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-800 animate-fade-in-down">
              Welcome to Your Dashboard
            </h1>
            <p className="mt-4 text-lg text-gray-600 animate-fade-in-up">
              Manage your grievances efficiently and stay updated.
            </p>
          </div>
          <div className="flex justify-center space-x-6">
            <Link href="/dashboard/user/submit-grievance">
              <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 w-64 animate-fade-in">
                <div className="text-center">
                  <div className="text-4xl mb-4 text-blue-600">📝</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Submit Grievance</h3>
                  <p className="text-gray-600">File a new grievance to address your concerns.</p>
                </div>
              </div>
            </Link>
            <Link href="/dashboard/user/track-grievance">
              <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 w-64 animate-fade-in">
                <div className="text-center">
                  <div className="text-4xl mb-4 text-green-600">📊</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Track Grievance</h3>
                  <p className="text-gray-600">Monitor the status of your submitted grievances.</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-down {
          animation: fadeInDown 1s ease-out;
        }
        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out;
        }
        .animate-fade-in {
          animation: fadeInDown 1s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
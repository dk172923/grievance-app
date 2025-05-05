'use client';
import Link from 'next/link';

export default function LandingPage() {
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white fade-in">
        <h1 className="text-5xl font-bold mb-6 tracking-tight drop-shadow-lg">
          Grievance Management System
        </h1>
        <p className="text-xl mb-10 font-light tracking-wide opacity-90">
          Submit and track your grievances with ease.
        </p>
        <div className="space-x-6">
          <Link href="/sign-in">
            <button className="px-8 py-3 bg-white text-blue-600 rounded-lg shadow-md hover:bg-gray-100 hover:scale-105 transition-all duration-300 font-semibold">
              Sign In
            </button>
          </Link>
          <Link href="/sign-up">
            <button className="px-8 py-3 bg-white text-blue-600 rounded-lg shadow-md hover:bg-gray-100 hover:scale-105 transition-all duration-300 font-semibold">
              Sign Up
            </button>
          </Link>
        </div>
      </div>
    </>
  );
}
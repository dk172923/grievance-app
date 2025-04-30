import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
      <h1 className="text-4xl font-bold mb-4">Grievance Management System</h1>
      <p className="text-lg mb-8">Submit and track your grievances with ease.</p>
      <div className="space-x-4">
        <Link href="/sign-in">
          <button className="px-6 py-2 bg-white text-blue-600 rounded-md hover:bg-gray-200 transition">
            Sign In
          </button>
        </Link>
        <Link href="/sign-up">
          <button className="px-6 py-2 bg-white text-blue-600 rounded-md hover:bg-gray-200 transition">
            Sign Up
          </button>
        </Link>
      </div>
    </div>
  );
}
'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PencilIcon, NoSymbolIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { ethers } from 'ethers';
import { getContract } from '../../../utils/contract';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  address: string | null;
  category_id: number | null;
  designation: 'Lead' | 'Senior' | 'Junior' | null;
  location: string | null;
  banned: boolean;
  role?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Grievance {
  id: number;
  user_id: string | null;
  title: string;
  description: string;
  language: 'English' | 'Tamil';
  category_id: number | null;
  categories: { name: string } | null;
  location: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Finished';
  file_url: string | null;
  created_at: string;
  updated_at: string;
  assigned_employee_id: string | null;
  assigned_employee: { name: string } | null;
  ai_summary: string | null;
  ai_sentiment: string | null;
  translated_text: string | null;
  blockchain_hash: string | null;
}

interface Action {
  id: number;
  action_text: string;
  employee_id: string | null;
  profiles: { name: string } | null;
  created_at: string;
}

interface FilterState {
  title: string;
  location: string;
  category_id: string;
  priority: string;
  status: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewGrievance, setViewGrievance] = useState<Grievance | null>(null);
  const [grievanceActions, setGrievanceActions] = useState<Action[]>([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    title: '',
    location: '',
    category_id: '',
    priority: '',
    status: '',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const _contract = await getContract();
        if (!_contract.verifyHash) {
          throw new Error('Contract missing verifyHash function');
        }
        setContract(_contract);
        await fetchData();
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError('Failed to initialize blockchain connection: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: userData, error: userError },
        { data: employeeData, error: employeeError },
        { data: categoryData, error: categoryError },
        { data: grievanceData, error: grievanceError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, phone_number, address, banned, role')
          .eq('role', 'user'),
        supabase
          .from('profiles')
          .select('id, name, email, category_id, designation, location, banned, role')
          .eq('role', 'employee'),
        supabase.from('categories').select('id, name').order('name'),
        supabase
          .from('grievances')
          .select(`
            id, user_id, title, description, language, category_id, location, priority, status,
            file_url, created_at, updated_at, assigned_employee_id, blockchain_hash,
            categories!category_id (name),
            profiles!assigned_employee_id (name),
            ai_summary, ai_sentiment, translated_text
          `)
          .order('created_at', { ascending: false }),
      ]);

      if (userError) throw userError;
      if (employeeError) throw employeeError;
      if (categoryError) throw categoryError;
      if (grievanceError) throw grievanceError;

      setUsers(userData || []);
      setEmployees(employeeData || []);
      setCategories(categoryData || []);
      setGrievances(grievanceData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
    router.push('/');
    router.refresh();
  }

  function openEditModal(profile: Profile) {
    setEditProfile(profile);
    setEditForm({
      name: profile.name,
      email: profile.email,
      phone_number: profile.phone_number ?? '',
      address: profile.address ?? '',
      category_id: profile.category_id,
      designation: profile.designation,
      location: profile.location ?? '',
    });
    setShowEditModal(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProfile) return;

    setError(null);
    try {
      if (!editForm.name || !editForm.email) {
        setError('Name and email are required.');
        return;
      }

      const updateData: Partial<Profile> = {
        name: editForm.name,
        email: editForm.email,
      };
      if (editProfile.role === 'user') {
        updateData.phone_number = editForm.phone_number;
        updateData.address = editForm.address;
      } else if (editProfile.role === 'employee') {
        updateData.category_id = editForm.category_id;
        updateData.designation = editForm.designation;
        updateData.location = editForm.location;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editProfile.id);
      if (error) throw error;

      setShowEditModal(false);
      setEditProfile(null);
      await fetchData();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile.');
    }
  }

  async function handleBanToggle(profile: Profile) {
    const action = profile.banned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} ${profile.name}?`)) return;

    setError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ banned: !profile.banned })
        .eq('id', profile.id);
      if (error) throw error;

      await fetchData();
    } catch (error: any) {
      console.error(`Error ${action}ning user:`, error);
      setError(`Failed to ${action} user.`);
    }
  }

  async function openViewModal(grievance: Grievance) {
    setViewGrievance(grievance);
    setVerifyResult(null);
    setError(null);
    try {
      const { data: actionsData, error: actionsError } = await supabase
        .from('grievance_actions')
        .select('id, action_text, employee_id, created_at, profiles!employee_id (name)')
        .eq('grievance_id', grievance.id)
        .order('created_at', { ascending: false });
      if (actionsError) throw actionsError;
      setGrievanceActions(actionsData || []);

      if (!grievance.blockchain_hash) {
        try {
          const response = await fetch('/api/grievances/store-hash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grievanceId: grievance.id,
              title: grievance.title,
              description: grievance.description,
              created_at: grievance.created_at,
            }),
          });
          const result = await response.json();
          if (result.error) throw new Error(result.error);
          setGrievances(grievances.map(g => g.id === grievance.id ? { ...g, blockchain_hash: result.hash } : g));
          setViewGrievance({ ...grievance, blockchain_hash: result.hash });
        } catch (err: any) {
          console.error('Store hash error:', err);
          setError('Failed to store grievance hash: ' + err.message);
        }
      }
    } catch (error: any) {
      console.error('Error fetching actions:', error);
      setError(error.message || 'Failed to load grievance actions.');
    }
    setShowViewModal(true);
  }

  async function handleVerifyGrievance(grievance: Grievance) {
    if (!contract) {
      setVerifyResult('⚠️ Blockchain contract not initialized');
      return;
    }

    if (typeof contract.verifyHash !== 'function') {
      console.error('Contract object:', contract);
      setVerifyResult('⚠️ Contract missing verifyHash function');
      return;
    }

    try {
      const { data: currentGrievance, error: fetchError } = await supabase
        .from('grievances')
        .select('id, title, description, created_at, blockchain_hash')
        .eq('id', grievance.id)
        .single();

      if (fetchError || !currentGrievance) {
        setVerifyResult('❌ Grievance not found in database');
        return;
      }

      const dataString = `${currentGrievance.id}${currentGrievance.title}${currentGrievance.description}${currentGrievance.created_at}`;
      const computedHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

      if (!currentGrievance.blockchain_hash) {
        setVerifyResult('❌ No blockchain hash stored for this grievance');
        return;
      }

      const isValid = await contract.verifyHash(computedHash);
      if (!isValid) {
        setVerifyResult('❌ Grievance data has been tampered with');
        return;
      }

      if (computedHash !== currentGrievance.blockchain_hash) {
        setVerifyResult('❌ Hash mismatch');
        return;
      }

      setVerifyResult('✅ Grievance is valid and untampered');
    } catch (err: any) {
      console.error('Verify error:', err);
      setVerifyResult(`⚠️ Error verifying grievance: ${err.message}`);
    }
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilterState(prev => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilterState({
      title: '',
      location: '',
      category_id: '',
      priority: '',
      status: '',
    });
  }

  const filteredGrievances = grievances.filter(g => {
    const titleMatch = filterState.title
      ? g.title.toLowerCase().includes(filterState.title.toLowerCase())
      : true;
    const locationMatch = filterState.location
      ? g.location.toLowerCase().includes(filterState.location.toLowerCase())
      : true;
    const categoryMatch = filterState.category_id
      ? g.category_id === Number(filterState.category_id)
      : true;
    const priorityMatch = filterState.priority
      ? g.priority === filterState.priority
      : true;
    const statusMatch = filterState.status
      ? g.status === filterState.status
      : true;

    return titleMatch && locationMatch && categoryMatch && priorityMatch && statusMatch;
  });

  return (
    <ProtectedRoute role="admin">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-900 animate-fade-in-down">
              Admin Dashboard
            </h1>
            <button
              onClick={handleLogout}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-300 shadow-md"
            >
              Logout
            </button>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-100 text-red-700 rounded-lg text-center animate-fade-in">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-lg p-6 text-center animate-fade-in">
                  <h2 className="text-2xl font-semibold text-gray-800">Total Users</h2>
                  <p className="mt-2 text-4xl font-bold text-indigo-600">{users.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 text-center animate-fade-in">
                  <h2 className="text-2xl font-semibold text-gray-800">Total Employees</h2>
                  <p className="mt-2 text-4xl font-bold text-indigo-600">{employees.length}</p>
                </div>
                <div className="bg-white rounded-xl shadow-lg p-6 text-center animate-fade-in">
                  <h2 className="text-2xl font-semibold text-gray-800">Total Grievances</h2>
                  <p className="mt-2 text-4xl font-bold text-indigo-600">{grievances.length}</p>
                </div>
              </div>

              <div className="mb-8">
                <a
                  href="/dashboard/admin/problem-hotspots"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-all duration-300 font-semibold"
                >
                  View Problem Hotspots (K-means Clustering)
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Users</h2>
                {users.length === 0 ? (
                  <p className="text-gray-600">No users found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-600">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left">Name</th>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Phone</th>
                          <th className="p-3 text-left">Address</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <tr key={user.id} className="border-t hover:bg-gray-50">
                            <td className="p-3">{user.name}</td>
                            <td className="p-3">{user.email}</td>
                            <td className="p-3">{user.phone_number || '-'}</td>
                            <td className="p-3">{user.address || '-'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  user.banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {user.banned ? 'Banned' : 'Active'}
                              </span>
                            </td>
                            <td className="p-3 flex space-x-2">
                              <button
                                onClick={() => openEditModal(user)}
                                className="p-2 text-indigo-600 hover:text-indigo-800"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleBanToggle(user)}
                                className={`p-2 ${user.banned ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                              >
                                {user.banned ? <CheckCircleIcon className="h-5 w-5" /> : <NoSymbolIcon className="h-5 w-5" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Employees</h2>
                {employees.length === 0 ? (
                  <p className="text-gray-600">No employees found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-600">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left">Name</th>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Department</th>
                          <th className="p-3 text-left">Designation</th>
                          <th className="p-3 text-left">Location</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map(employee => (
                          <tr key={employee.id} className="border-t hover:bg-gray-50">
                            <td className="p-3">{employee.name}</td>
                            <td className="p-3">{employee.email}</td>
                            <td className="p-3">
                              {categories.find(c => c.id === employee.category_id)?.name || '-'}
                            </td>
                            <td className="p-3">{employee.designation || '-'}</td>
                            <td className="p-3">{employee.location || '-'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  employee.banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {employee.banned ? 'Banned' : 'Active'}
                              </span>
                            </td>
                            <td className="p-3 flex space-x-2">
                              <button
                                onClick={() => openEditModal(employee)}
                                className="p-2 text-indigo-600 hover:text-indigo-800"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleBanToggle(employee)}
                                className={`p-2 ${employee.banned ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                              >
                                {employee.banned ? <CheckCircleIcon className="h-5 w-5" /> : <NoSymbolIcon className="h-5 w-5" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Grievances</h2>
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label htmlFor="filter-title" className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <input
                      type="text"
                      id="filter-title"
                      value={filterState.title}
                      onChange={e => handleFilterChange('title', e.target.value)}
                      placeholder="Search title..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-location" className="block text-sm font-medium text-gray-700">
                      Location
                    </label>
                    <input
                      type="text"
                      id="filter-location"
                      value={filterState.location}
                      onChange={e => handleFilterChange('location', e.target.value)}
                      placeholder="Search location..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="filter-category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <select
                      id="filter-category"
                      value={filterState.category_id}
                      onChange={e => handleFilterChange('category_id', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                    >
                      <option value="">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-priority" className="block text-sm font-medium text-gray-700">
                      Priority
                    </label>
                    <select
                      id="filter-priority"
                      value={filterState.priority}
                      onChange={e => handleFilterChange('priority', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                    >
                      <option value="">All Priorities</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      id="filter-status"
                      value={filterState.status}
                      onChange={e => handleFilterChange('status', e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                    >
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Finished">Finished</option>
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Clear Filters
                  </button>
                </div>

                {filteredGrievances.length === 0 ? (
                  <p className="text-gray-600">No grievances found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-600">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left">ID</th>
                          <th className="p-3 text-left">Title</th>
                          <th className="p-3 text-left">Location</th>
                          <th className="p-3 text-left">Category</th>
                          <th className="p-3 text-left">Priority</th>
                          <th className="p-3 text-left">Created At</th>
                          <th className="p-3 text-left">Status</th>
                          <th className="p-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGrievances.map(grievance => (
                          <tr key={grievance.id} className="border-t hover:bg-gray-50">
                            <td className="p-3">{grievance.id}</td>
                            <td className="p-3">{grievance.title}</td>
                            <td className="p-3">{grievance.location || '-'}</td>
                            <td className="p-3">{grievance.categories?.name || '-'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  grievance.priority === 'High'
                                    ? 'bg-red-100 text-red-800'
                                    : grievance.priority === 'Medium'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {grievance.priority}
                              </span>
                            </td>
                            <td className="p-3">{new Date(grievance.created_at).toLocaleDateString()}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  grievance.status === 'Pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : grievance.status === 'In Progress'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {grievance.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => openViewModal(grievance)}
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {showEditModal && editProfile && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl p-8 max-w-lg w-full">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                      Edit {editProfile.role === 'user' ? 'User' : 'Employee'}
                    </h2>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          value={editForm.name || ''}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={editForm.email || ''}
                          onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                          required
                        />
                      </div>
                      {editProfile.role === 'user' && (
                        <>
                          <div>
                            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
                              Phone Number
                            </label>
                            <input
                              type="tel"
                              id="phone_number"
                              value={editForm.phone_number || ''}
                              onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                            />
                          </div>
                          <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                              Address
                            </label>
                            <textarea
                              id="address"
                              value={editForm.address || ''}
                              onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                            />
                          </div>
                        </>
                      )}
                      {editProfile.role === 'employee' && (
                        <>
                          <div>
                            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">
                              Department
                            </label>
                            <select
                              id="category_id"
                              value={editForm.category_id ?? ''}
                              onChange={e => setEditForm({ ...editForm, category_id: Number(e.target.value) || undefined })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                            >
                              <option value="">Select Department</option>
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor="designation" className="block text-sm font-medium text-gray-700">
                              Designation
                            </label>
                            <select
                              id="designation"
                              value={editForm.designation || ''}
                              onChange={e =>
                                setEditForm({ ...editForm, designation: e.target.value as 'Lead' | 'Senior' | 'Junior' | undefined })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                            >
                              <option value="">Select Designation</option>
                              <option value="Lead">Lead</option>
                              <option value="Senior">Senior</option>
                              <option value="Junior">Junior</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                              Location
                            </label>
                            <input
                              type="text"
                              id="location"
                              value={editForm.location || ''}
                              onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                            />
                          </div>
                        </>
                      )}
                      <div className="flex justify-end space-x-4">
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {showViewModal && viewGrievance && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-6">Grievance Details</h2>
                    <div className="space-y-4">
                      <div>
                        <span className="font-medium text-gray-700">ID:</span> {viewGrievance.id}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Title:</span> {viewGrievance.title}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Description:</span> {viewGrievance.description}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Language:</span> {viewGrievance.language}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Location:</span> {viewGrievance.location}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Category:</span> {viewGrievance.categories?.name || '-'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Priority:</span>{' '}
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            viewGrievance.priority === 'High'
                              ? 'bg-red-100 text-red-800'
                              : viewGrievance.priority === 'Medium'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {viewGrievance.priority}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Status:</span>{' '}
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            viewGrievance.status === 'Pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : viewGrievance.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {viewGrievance.status}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Created At:</span>{' '}
                        {new Date(viewGrievance.created_at).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Updated At:</span>{' '}
                        {new Date(viewGrievance.updated_at).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Assigned Employee:</span>{' '}
                        {viewGrievance.assigned_employee?.name || '-'}
                      </div>
                      {viewGrievance.file_url && (
                        <div>
                          <span className="font-medium text-gray-700">Attachment:</span>{' '}
                          <a
                            href={viewGrievance.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            View File
                          </a>
                        </div>
                      )}
                      {viewGrievance.ai_summary && (
                        <div>
                          <span className="font-medium text-gray-700">AI Summary:</span> {viewGrievance.ai_summary}
                        </div>
                      )}
                      {viewGrievance.ai_sentiment && (
                        <div>
                          <span className="font-medium text-gray-700">AI Sentiment:</span> {viewGrievance.ai_sentiment}
                        </div>
                      )}
                      {viewGrievance.translated_text && (
                        <div>
                          <span className="font-medium text-gray-700">Translated Text:</span>{' '}
                          {viewGrievance.translated_text}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Blockchain Hash:</span>{' '}
                        {viewGrievance.blockchain_hash || 'Not yet stored'}
                        {viewGrievance.blockchain_hash && (
                          <button
                            onClick={() => handleVerifyGrievance(viewGrievance)}
                            className="ml-4 px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                      {verifyResult && (
                        <div className={`text-lg ${verifyResult.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
                          <span className="font-medium text-gray-700">Verification Result:</span> {verifyResult}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Actions Taken:</span>
                        {grievanceActions.length === 0 ? (
                          <p className="text-gray-600 mt-2">No actions recorded.</p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {grievanceActions.map(action => (
                              <li key={action.id} className="border-t pt-2">
                                <p>
                                  <span className="font-medium">Description:</span> {action.action_text}
                                </p>
                                <p>
                                  <span className="font-medium">Performed By:</span> {action.profiles?.name || 'Unknown'}
                                </p>
                                <p>
                                  <span className="font-medium">Performed At:</span>{' '}
                                  {new Date(action.created_at).toLocaleString()}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end mt-6">
                      <button
                        onClick={() => setShowViewModal(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
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
          .animate-fade-in-down {
            animation: fadeInDown 0.5s ease-out;
          }
          .animate-fade-in {
            animation: fadeInDown 0.5s ease-out;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
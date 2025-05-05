'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Header from '../../../../components/Header';
import { PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function GrievanceSubmissionForm() {
  const [categories, setCategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    language: 'English' as 'English' | 'Tamil',
    category_id: 0,
    location: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    isAnonymous: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      if (data) {
        setCategories(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, category_id: data[0].id }));
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setError('Failed to load categories.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setFileError('File size exceeds 5MB.');
        return;
      }
      setFile(selectedFile);
      setFileError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.size > 5 * 1024 * 1024) {
        setFileError('File size exceeds 5MB.');
        return;
      }
      setFile(droppedFile);
      setFileError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('User not authenticated.');

      let fileUrl: string | null = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${sessionData.session.user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('grievance-files')
          .upload(fileName, file);
        if (uploadError) throw new Error('File upload failed: ' + uploadError.message);
        fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/grievance-files/${fileName}`;
      }

      const { error: insertError } = await supabase.from('grievances').insert([
        {
          title: formData.title,
          description: formData.description,
          language: formData.language,
          category_id: formData.category_id,
          location: formData.location,
          priority: formData.priority,
          status: 'Pending' as 'Pending' | 'In Progress' | 'Resolved' | 'Closed',
          user_id: formData.isAnonymous ? null : sessionData.session.user.id,
          file_url: fileUrl,
          assigned_employee_id: null,
        },
      ]);

      if (insertError) throw new Error('Grievance submission failed: ' + insertError.message);

      alert('Grievance submitted successfully!');
      setFormData({
        title: '',
        description: '',
        language: 'English',
        category_id: categories[0]?.id || 0,
        location: '',
        priority: 'Medium',
        isAnonymous: false,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Error submitting grievance:', error);
      setError(error.message || 'Failed to submit grievance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute role="user">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Header role="user" />
        <div className="max-w-2xl mx-auto p-8">
          <h2 className="text-4xl font-extrabold text-gray-800 mb-8 text-center animate-fade-in-down">
            Submit a Grievance
          </h2>
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-xl shadow-lg space-y-6 animate-fade-in"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                id="title"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                required
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                id="location"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                id="category"
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                id="language"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value as 'English' | 'Tamil' })}
              >
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="priority"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'Low' | 'Medium' | 'High' })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Document (Optional)
              </label>
              <div
                className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-500 transition-all duration-200"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="space-y-2 text-center">
                  <PaperClipIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      type="file"
                      ref={fileInputRef}
                      className="sr-only"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                      disabled={isSubmitting}
                    />
                  </label>
                  <p className="pl-1 text-sm text-gray-600">or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF or image up to 5MB</p>
                  {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                  {file && (
                    <div className="mt-2 flex items-center justify-center">
                      <span className="text-sm text-gray-600">{file.name}</span>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="anonymous"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={formData.isAnonymous}
                onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              />
              <label htmlFor="anonymous" className="ml-2 block text-sm text-gray-700">
                Submit Anonymously
              </label>
            </div>
            {error && (
              <p className="text-red-600 text-sm bg-red-100 p-3 rounded-lg">{error}</p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 rounded-lg text-white font-semibold ${
                isSubmitting
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } transition-all duration-300`}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Grievance'}
            </button>
          </form>
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
        .animate-fade-in-down {
          animation: fadeInDown 1s ease-out;
        }
        .animate-fade-in {
          animation: fadeInDown 1s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  );
}
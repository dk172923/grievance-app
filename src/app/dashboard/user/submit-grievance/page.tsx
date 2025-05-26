'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase, uploadFileToSupabase } from '../../../../lib/supabase';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Header from '../../../../components/Header';
import { PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { analyzePriority, analyzeDocument, translateTamilToEnglish } from '../../../../lib/ai-utils';

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
  const [documentAnalysis, setDocumentAnalysis] = useState<{
    summary: string;
    keywords: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    extractedText: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError('File size exceeds 5MB.');
      return;
    }
    setFile(selectedFile);
    setFileError(null);

    try {
      setIsAnalyzing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      const analysis = await res.json();
      if (analysis.error) {
        setFileError('Failed to analyze document: ' + analysis.error);
        setDocumentAnalysis(null);
      } else {
        setDocumentAnalysis({
          summary: analysis.summary,
          keywords: analysis.keywords,
          sentiment: analysis.sentiment,
          extractedText: analysis.extractedText,
        });
      }
    } catch (error) {
      setFileError('Failed to analyze document. Please try again.');
      setDocumentAnalysis(null);
    } finally {
      setIsAnalyzing(false);
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
      // Trigger file analysis
      handleFileChange({ target: { files: [droppedFile] } } as any);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFile = () => {
    setFile(null);
    setFileError(null);
    setDocumentAnalysis(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setFormData({ ...formData, description: newDescription });
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: sessionData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.warn('Authentication warning:', authError.message);
      }
      if (!sessionData?.session) {
        console.warn('No session data found, but continuing with submission');
      }

      const userId = sessionData?.session?.user?.id;
      if (userId) {
        console.log('Authenticated as:', sessionData.session.user.email);
      }

      let fileUrl: string | null = null;
      if (file) {
        console.log('Starting file upload process...');
        fileUrl = await uploadFileToSupabase(file, 'grievance-files', userId || 'anonymous');
        if (!fileUrl) {
          console.error('File upload returned null');
          throw new Error('Failed to upload file. Please try again later.');
        }
        console.log('File uploaded successfully:', fileUrl);
      }

      let translatedText = '';
      if (formData.language === 'Tamil') {
        let toTranslate = formData.description;
        if (documentAnalysis?.extractedText) {
          toTranslate += '\n' + documentAnalysis.extractedText;
        }
        translatedText = await translateTamilToEnglish(toTranslate);
      }

      let finalPriority = 'Medium';
      try {
        console.log('Sending to FastAPI:', {
          description: formData.description,
          document_text: documentAnalysis?.extractedText || '',
        });
        finalPriority = await analyzePriority({
          description: formData.description,
          document_text: documentAnalysis?.extractedText || '',
        });
        console.log('Received priority from FastAPI:', finalPriority);
      } catch (error) {
        console.error('Error analyzing priority on submit:', error);
        finalPriority = 'Medium';
      }

      // Insert grievance into Supabase
      const { data: insertedGrievance, error: insertError } = await supabase
        .from('grievances')
        .insert([
          {
            title: formData.title,
            description: formData.description,
            language: formData.language,
            category_id: formData.category_id,
            location: formData.location,
            priority: finalPriority,
            status: 'Pending' as 'Pending' | 'In Progress' | 'Resolved' | 'Closed',
            user_id: formData.isAnonymous ? null : userId,
            file_url: fileUrl,
            assigned_employee_id: null,
            translated_text: translatedText,
          },
        ])
        .select('id, created_at')
        .single();

      if (insertError) throw new Error('Grievance submission failed: ' + insertError.message);
      if (!insertedGrievance) throw new Error('Failed to retrieve inserted grievance details');

      // Store blockchain hash
      try {
        const response = await fetch('/api/grievances/store-hash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grievanceId: insertedGrievance.id,
            title: formData.title,
            description: formData.description,
            created_at: insertedGrievance.created_at,
          }),
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        console.log('Blockchain hash stored:', result.hash);
      } catch (err: any) {
        console.error('Store hash error:', err);
        setError('Grievance submitted, but failed to store blockchain hash: ' + err.message);
        // Allow submission to complete despite hash error
      }

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
      setDocumentAnalysis(null);
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
                onChange={handleDescriptionChange}
              />
              <p className="mt-1 text-sm text-gray-500">
                Priority will be automatically assigned by AI upon submission based on your description and uploaded document.
              </p>
            </div>
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority (AI-Assigned on Submit)
              </label>
              <input
                type="text"
                id="priority"
                readOnly
                className={`w-full p-3 border border-gray-300 rounded-lg bg-gray-100 capitalize ${
                  formData.priority === 'High'
                    ? 'text-red-600'
                    : formData.priority === 'Medium'
                    ? 'text-orange-600'
                    : 'text-gray-600'
                }`}
                value={formData.priority}
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
                      accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.txt"
                      onChange={handleFileChange}
                      disabled={isSubmitting || isAnalyzing}
                    />
                  </label>
                  <p className="pl-1 text-sm text-gray-600">or drag and drop</p>
                  <p className="text-xs text-gray-500">
                    PDF, Word, images (JPG/PNG), or text files up to 5MB
                  </p>
                  {fileError && <p className="text-sm text-red-600">{fileError}</p>}
                  {isAnalyzing && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      <p className="text-sm text-indigo-600">Analyzing document...</p>
                    </div>
                  )}
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
              {documentAnalysis && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <h4 className="font-medium text-gray-700 mb-2">Document Analysis</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Summary:</span> {documentAnalysis.summary}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Keywords:</span> {documentAnalysis.keywords.join(', ')}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Sentiment:</span>{' '}
                      <span
                        className={`capitalize ${
                          documentAnalysis.sentiment === 'positive'
                            ? 'text-green-600'
                            : documentAnalysis.sentiment === 'negative'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {documentAnalysis.sentiment}
                      </span>
                    </p>
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Extracted Text:</p>
                      <div className="max-h-40 overflow-y-auto p-2 bg-white rounded border border-gray-200">
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">
                          {documentAnalysis.extractedText}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
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
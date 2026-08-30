import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../store/authContext';
import { documentApi } from '../services/api';
import ProcessingBadge from '../components/ProcessingBadge';
import ChunkInspectorModal from '../components/ChunkInspectorModal';
import { FileUp, FileText, Trash2, Eye, RefreshCw, AlertCircle, CheckCircle, Tag, Layers, Loader2 } from 'lucide-react';

const CATEGORIES = [
  'General', 'Admissions', 'Departments', 'Courses', 'Fees',
  'Examinations', 'Academic Calendar', 'Hostel', 'Library',
  'Clubs', 'Placements', 'Scholarships', 'Policies', 'Events'
];

export default function Documents() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Upload Form State
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');

  // Inspector Modal State
  const [inspectDoc, setInspectDoc] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/chat');
      } else {
        fetchDocuments();
      }
    }
  }, [user, isAdmin, authLoading, selectedCategory]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await documentApi.getDocuments(selectedCategory || null);
      if (res.success && res.data?.documents) {
        setDocuments(res.data.documents);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch document list');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        // Auto fill title from filename
        const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('category', category);

    try {
      const res = await documentApi.uploadDocument(formData);
      if (res.success) {
        setSuccess(`Document "${res.data.document.title}" processed & indexed successfully!`);
        setFile(null);
        setTitle('');
        setCategory('General');
        fetchDocuments();
      }
    } catch (err) {
      setError(err.message || 'Document upload and chunking failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, docTitle) => {
    if (!confirm(`Are you sure you want to delete document "${docTitle}" and all its chunk vectors?`)) {
      return;
    }

    try {
      await documentApi.deleteDocument(id);
      setSuccess(`Document "${docTitle}" deleted.`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    }
  };

  const handleInspect = async (id) => {
    try {
      const res = await documentApi.getDocumentById(id);
      if (res.success && res.data?.document) {
        setInspectDoc(res.data.document);
      }
    } catch (err) {
      setError(err.message || 'Failed to inspect document chunks.');
    }
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Document Knowledge Base</h1>
          <p className="text-sm text-gray-400 mt-1">Upload and manage official college PDFs and documents powering the RAG engine.</p>
        </div>

        <button
          onClick={fetchDocuments}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700 flex items-center space-x-2 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Upload Interface Box */}
      <div className="glass-card p-6 rounded-2xl border border-gray-800">
        <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center space-x-2">
          <FileUp className="w-5 h-5 text-indigo-400" />
          <span>Upload Official College Document</span>
        </h2>

        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* File Selector */}
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Select Document File (PDF, TXT, MD, DOC)
            </label>
            <div className="border-2 border-dashed border-gray-700 hover:border-indigo-500/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-900/50 relative">
              <input
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileUp className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
              <p className="text-sm font-medium text-gray-200">
                {file ? file.name : 'Click or drop document file here to upload'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Supports PDF, TXT, MD up to 15 MB</p>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Document Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Academic Fee Structure 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Knowledge Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Submit Action */}
          <div className="flex items-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 text-white font-semibold shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Parsing & Chunking...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  <span>Upload & Process</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* Category Filter bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <span className="text-xs font-semibold text-gray-400 shrink-0 mr-2">Filter Category:</span>
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
            selectedCategory === ''
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          All Categories
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/90 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Document Title</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Page / Chunks</th>
                <th className="px-6 py-4 font-semibold">Uploaded Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500 text-sm">
                    No documents uploaded yet in this category.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-100 flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-200">{doc.title}</p>
                        <p className="text-xs text-gray-500 font-mono">{doc.filename}</p>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-gray-800 text-gray-300 text-xs">
                        <Tag className="w-3 h-3 text-indigo-400" />
                        <span>{doc.category}</span>
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <ProcessingBadge status={doc.processing_status} />
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-400">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>
                          {doc.file_metadata?.chunkCount || 0} chunks ({doc.page_count || 1} pages)
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleInspect(doc.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title="Inspect Vector Chunks"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chunk Inspector Modal */}
      {inspectDoc && (
        <ChunkInspectorModal
          document={inspectDoc}
          onClose={() => setInspectDoc(null)}
        />
      )}

    </div>
  );
}

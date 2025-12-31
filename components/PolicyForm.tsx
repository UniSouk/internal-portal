'use client';

import { useState, useEffect } from 'react';

interface PolicyFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  editingPolicy?: any;
  isEditing?: boolean;
}

export default function PolicyForm({ onSubmit, onCancel, editingPolicy, isEditing = false }: PolicyFormProps) {
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string; department: string }>>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [formData, setFormData] = useState({
    title: editingPolicy?.title || '',
    category: editingPolicy?.category || 'HR',
    content: editingPolicy?.content || '',
    ownerId: editingPolicy?.ownerId || '',
    status: editingPolicy?.status || 'DRAFT',
    effectiveDate: editingPolicy?.effectiveDate ? new Date(editingPolicy.effectiveDate).toISOString().split('T')[0] : '',
    expiryDate: editingPolicy?.expiryDate ? new Date(editingPolicy.expiryDate).toISOString().split('T')[0] : '',
    reviewDate: editingPolicy?.reviewDate ? new Date(editingPolicy.reviewDate).toISOString().split('T')[0] : '',
    lastReviewDate: editingPolicy?.lastReviewDate ? new Date(editingPolicy.lastReviewDate).toISOString().split('T')[0] : ''
  });

  const [uploadMode, setUploadMode] = useState<'text' | 'file'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccessibleEmployees();
  }, []);

  useEffect(() => {
    // Set default owner to first available employee when employees are loaded
    if (employees.length > 0 && !formData.ownerId && !editingPolicy) {
      setFormData(prev => ({ ...prev, ownerId: employees[0].id }));
    }
  }, [employees, editingPolicy]);

  const fetchAccessibleEmployees = async () => {
    try {
      const response = await fetch('/api/employees/accessible');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        console.error('Failed to fetch accessible employees');
      }
    } catch (error) {
      console.error('Error fetching accessible employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);

    try {
      let policyData = {
        ...formData,
        id: editingPolicy?.id,
        effectiveDate: formData.effectiveDate ? new Date(formData.effectiveDate) : null,
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : null,
        reviewDate: formData.reviewDate ? new Date(formData.reviewDate) : null,
        lastReviewDate: formData.lastReviewDate ? new Date(formData.lastReviewDate) : null,
      };

      // Handle file upload if file is selected
      if (uploadMode === 'file' && selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('folder', 'policies');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload file');
        }

        const uploadResult = await uploadResponse.json();
        
        // Add file information to policy data
        policyData = {
          ...policyData,
          filePath: uploadResult.filePath,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          content: null // Clear content when using file upload
        } as any;
      }

      onSubmit(policyData);
    } catch (error) {
      console.error('Error creating policy:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to create policy');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Only PDF and Word documents are allowed');
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setUploadError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setUploadError(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {isEditing ? 'Edit Policy' : 'Create New Policy'}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Policy Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="HR">HR</option>
                    <option value="IT">IT</option>
                    <option value="SECURITY">Security</option>
                    <option value="COMPLIANCE">Compliance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Owner *</label>
                  <select
                    name="ownerId"
                    value={formData.ownerId}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Owner</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="REVIEW">Ready for Review</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Note: APPROVED, REJECTED, and PUBLISHED status are set automatically through the approval workflow
                  </p>
                </div>
              </div>
            </div>

            {/* Timeframe Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">Policy Timeframe</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Effective Date</label>
                  <input
                    type="date"
                    name="effectiveDate"
                    value={formData.effectiveDate}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Next Review Date</label>
                  <input
                    type="date"
                    name="reviewDate"
                    value={formData.reviewDate}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Review Date</label>
                  <input
                    type="date"
                    name="lastReviewDate"
                    value={formData.lastReviewDate}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Content/File Upload */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">Policy Content</h4>
              
              {/* Upload Mode Toggle */}
              <div className="mb-4">
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="text"
                      checked={uploadMode === 'text'}
                      onChange={(e) => setUploadMode(e.target.value as 'text' | 'file')}
                      className="mr-2"
                    />
                    Write Policy Text
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMode"
                      value="file"
                      checked={uploadMode === 'file'}
                      onChange={(e) => setUploadMode(e.target.value as 'text' | 'file')}
                      className="mr-2"
                    />
                    Upload PDF/Word Document
                  </label>
                </div>
              </div>

              {uploadMode === 'text' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Policy Content</label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    required={uploadMode === 'text'}
                    rows={12}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter the policy content in Markdown format..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Upload Policy Document *</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    required={uploadMode === 'file'}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Supported formats: PDF, Word (.doc, .docx). Maximum size: 10MB
                  </p>
                  {selectedFile && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-700">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {uploadError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {uploading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Policy' : 'Create Policy')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
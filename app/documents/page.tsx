'use client';

import { useState, useEffect } from 'react';
import DocumentForm from '@/components/DocumentForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DocumentCategory, DocumentStatus } from '@/types';

interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  content: string;
  version: number;
  status: DocumentStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string; department: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchEmployees();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        // Handle paginated response structure
        const employeesArray = data.employees || data; // Support both paginated and direct array responses
        setEmployees(Array.isArray(employeesArray) ? employeesArray : []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreateDocument = async (documentData: any) => {
    try {
      if (editingDocument) {
        // Update existing document
        const response = await fetch(`/api/documents?id=${editingDocument.id}&updatedBy=system`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentData),
        });

        if (response.ok) {
          const updatedDocument = await response.json();
          setDocuments(documents.map(doc => doc.id === editingDocument.id ? updatedDocument : doc));
          setShowForm(false);
          setEditingDocument(null);
        } else {
          const errorData = await response.json();
          alert(`Failed to update document: ${errorData.error}`);
        }
      } else {
        // Create new document
        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentData),
        });

        if (response.ok) {
          const newDocument = await response.json();
          setDocuments([newDocument, ...documents]);
          setShowForm(false);
        } else {
          const errorData = await response.json();
          alert(`Failed to create document: ${errorData.error}`);
        }
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document');
    }
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocument(document);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingDocument(null);
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      const response = await fetch(`/api/documents?id=${id}&deletedBy=system`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== id));
        setDeleteConfirm(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete document: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.DRAFT:
        return 'bg-gray-100 text-gray-800';
      case DocumentStatus.REVIEW:
        return 'bg-yellow-100 text-yellow-800';
      case DocumentStatus.APPROVED:
        return 'bg-blue-100 text-blue-800';
      case DocumentStatus.PUBLISHED:
        return 'bg-green-100 text-green-800';
      case DocumentStatus.ARCHIVED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: DocumentCategory) => {
    switch (category) {
      case DocumentCategory.POLICY:
        return 'bg-purple-100 text-purple-800';
      case DocumentCategory.PROCEDURE:
        return 'bg-blue-100 text-blue-800';
      case DocumentCategory.GUIDELINE:
        return 'bg-green-100 text-green-800';
      case DocumentCategory.TEMPLATE:
        return 'bg-yellow-100 text-yellow-800';
      case DocumentCategory.MANUAL:
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading documents...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['CEO', 'CTO', 'HR', 'MANAGER', 'HR_MANAGER', 'ENGINEERING_MANAGER']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Document Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Host and manage company documentation including policies, procedures, and manuals.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Create Document
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((document) => (
          <div key={document.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(document.category)}`}>
                    {document.category}
                  </span>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.status)}`}>
                  {document.status}
                </span>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 truncate">
                  {document.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Version {document.version} • by {document.owner?.name || 'Unknown'}
                </p>
              </div>

              {document.tags.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-1">
                    {document.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {document.tags.length > 3 && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        +{document.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="text-sm text-gray-600 line-clamp-3">
                  {document.content.substring(0, 150)}...
                </p>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {new Date(document.createdAt).toLocaleDateString()}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedDocument(document)}
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleEditDocument(document)}
                    className="text-green-600 hover:text-green-500 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(document.id)}
                    className="text-red-600 hover:text-red-500 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new document.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Document</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this document? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteDocument(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <DocumentForm
          onSubmit={handleCreateDocument}
          onCancel={handleCancelForm}
          editingDocument={editingDocument}
          isEditing={!!editingDocument}
        />
      )}

      {selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{selectedDocument.title}</h3>
                  <p className="text-sm text-gray-500">
                    Version {selectedDocument.version} • by {selectedDocument.owner?.name || 'Unknown'} • {selectedDocument.owner?.department || 'No Department'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex space-x-2 mb-4">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(selectedDocument.category)}`}>
                  {selectedDocument.category}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedDocument.status)}`}>
                  {selectedDocument.status}
                </span>
              </div>

              {selectedDocument.tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {selectedDocument.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap text-sm text-gray-700">
                  {selectedDocument.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedRoute>
  );
}
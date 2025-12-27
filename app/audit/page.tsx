'use client';

import { useState, useEffect } from 'react';
import { formatChange, parseChangesFromAuditLog, formatMultipleChanges, formatValue as formatValueFromLib } from '@/lib/changeFormatter';
import Pagination from '@/components/Pagination';
import { useNotification } from '@/components/Notification';
import ElegantSelect from '@/components/ElegantSelect';

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  changedBy: {
    id: string;
    name: string;
    email: string;
    department: string;
  } | null; // Allow null for deleted employees
}

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    entityType: '',
    limit: 50
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);
  const { showNotification, NotificationComponent } = useNotification();

  useEffect(() => {
    fetchAuditLogs();
  }, [filters, currentPage, itemsPerPage]);

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.entityType) params.append('entityType', filters.entityType);
      params.append('limit', itemsPerPage.toString());
      params.append('page', currentPage.toString());

      const response = await fetch(`/api/audit?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.auditLogs || data);
        setTotalAuditLogs(data.total || data.length);
      } else {
        showNotification('error', 'Fetch Failed', 'Failed to load audit logs. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      showNotification('error', 'Network Error', 'Unable to load audit logs. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setFilters({ ...filters, limit: newItemsPerPage });
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const totalPages = Math.ceil(totalAuditLogs / itemsPerPage);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType) {
      case 'EMPLOYEE':
        return 'bg-blue-100 text-blue-800';
      case 'ASSET':
        return 'bg-green-100 text-green-800';
      case 'POLICY':
        return 'bg-purple-100 text-purple-800';
      case 'DOCUMENT':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCESS':
        return 'bg-red-100 text-red-800';
      case 'APPROVAL_WORKFLOW':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEntityTypeIcon = (entityType: string) => {
    switch (entityType) {
      case 'EMPLOYEE':
        return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      case 'ASSET':
        return 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z';
      case 'POLICY':
        return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
      case 'DOCUMENT':
        return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
      case 'ACCESS':
        return 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2L4.257 9.257a6 6 0 017.743-7.743L15 5v2z';
      case 'APPROVAL_WORKFLOW':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
    }
  };

  const formatValue = (value: string | null) => {
    if (!value) return '-';
    
    // Try to parse and format the value using our improved formatter
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object') {
        // Use our improved formatValue function
        return formatValueFromLib(parsed, 'object');
      }
      return value;
    } catch {
      return value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
  };

  const formatChangeDescription = (log: AuditLog) => {
    const changes = parseChangesFromAuditLog(log.oldValue || null, log.newValue || null, log.fieldChanged);
    const description = formatMultipleChanges(changes);
    
    // Add context based on entity type
    const entityContext = getEntityContext(log.entityType, log.entityId);
    
    return `${description}${entityContext}`;
  };

  const getEntityContext = (entityType: string, entityId: string) => {
    const shortId = entityId.substring(0, 8);
    switch (entityType) {
      case 'EMPLOYEE':
        return ` (Employee ${shortId})`;
      case 'POLICY':
        return ` (Policy ${shortId})`;
      case 'ASSET':
        return ` (Asset ${shortId})`;
      case 'DOCUMENT':
        return ` (Document ${shortId})`;
      case 'ACCESS':
        return ` (Access Request ${shortId})`;
      case 'APPROVAL_WORKFLOW':
        return ` (Workflow ${shortId})`;
      default:
        return ` (${shortId})`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="text-lg text-gray-600">Loading audit logs...</div>
        </div>
      </div>
    );
  }

  console.log("auditLogs: ", auditLogs);

  return (
    <div className="min-h-screen bg-gray-50">
      {NotificationComponent}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              Track all system changes and activities across the platform.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
              <ElegantSelect
                options={[
                  { value: '', label: 'All Types' },
                  { 
                    value: 'EMPLOYEE', 
                    label: 'Employee',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )
                  },
                  { 
                    value: 'ASSET', 
                    label: 'Asset',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    )
                  },
                  { 
                    value: 'POLICY', 
                    label: 'Policy',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )
                  },
                  { 
                    value: 'DOCUMENT', 
                    label: 'Document',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )
                  },
                  { 
                    value: 'ACCESS', 
                    label: 'Access',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v-2L4.257 9.257a6 6 0 017.743-7.743L15 5v2z" />
                      </svg>
                    )
                  },
                  { 
                    value: 'APPROVAL_WORKFLOW', 
                    label: 'Approval Workflow',
                    icon: (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )
                  }
                ]}
                value={filters.entityType}
                onChange={(value) => setFilters({ ...filters, entityType: value })}
                placeholder="All Types"
                showClearButton={true}
                className="w-full"
                size="md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Records per Page</label>
              <ElegantSelect
                options={[
                  { value: '50', label: '50 records' },
                  { value: '100', label: '100 records' },
                  { value: '200', label: '200 records' },
                  { value: '500', label: '500 records' }
                ]}
                value={filters.limit.toString()}
                onChange={(value) => setFilters({ ...filters, limit: parseInt(value) })}
                className="w-full"
                size="md"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ entityType: '', limit: 50 });
                  setCurrentPage(1);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Field Changed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Changed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-96">
                    Changes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {auditLogs.map((log, index) => (
                  <tr key={log.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getEntityTypeIcon(log.entityType)} />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEntityTypeColor(log.entityType)} mb-1`}>
                            {log.entityType}
                          </span>
                          <div className="text-xs text-gray-500 font-mono">
                            {log.entityId.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.fieldChanged}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {log.changedBy ? log.changedBy.name.charAt(0).toUpperCase() : 'S'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {log.changedBy ? log.changedBy.name : 'System User'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {log.changedBy ? log.changedBy.department : 'System'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="min-w-96 max-w-2xl">
                        {/* Main change description */}
                        <div className="text-sm font-medium text-gray-900 mb-2 break-words">
                          {formatChangeDescription(log)}
                        </div>
                        
                        {/* Visual indicator for change type */}
                        <div className="flex items-center space-x-2 mb-2 flex-wrap">
                          {log.fieldChanged === 'created' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Created
                            </span>
                          )}
                          {log.fieldChanged === 'deleted' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Deleted
                            </span>
                          )}
                          {log.fieldChanged.includes('status') && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Status Change
                            </span>
                          )}
                          {!['created', 'deleted'].includes(log.fieldChanged) && !log.fieldChanged.includes('status') && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Updated
                            </span>
                          )}
                        </div>
                        
                        {/* Show detailed old/new values in a collapsible format */}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700 flex items-center">
                            <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View technical details
                          </summary>
                          <div className="mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                            {log.oldValue && (
                              <div>
                                <span className="font-medium text-red-600">Before:</span>
                                <div className="bg-red-50 p-2 rounded mt-1 overflow-hidden font-mono text-xs border border-red-200 break-all max-h-32 overflow-y-auto">
                                  {formatValue(log.oldValue).substring(0, 500)}
                                  {formatValue(log.oldValue).length > 500 && '...'}
                                </div>
                              </div>
                            )}
                            {log.newValue && (
                              <div>
                                <span className="font-medium text-green-600">After:</span>
                                <div className="bg-green-50 p-2 rounded mt-1 overflow-hidden font-mono text-xs border border-green-200 break-all max-h-32 overflow-y-auto">
                                  {formatValue(log.newValue).substring(0, 500)}
                                  {formatValue(log.newValue).length > 500 && '...'}
                                </div>
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                              Field: <code className="bg-gray-100 px-1 rounded break-all">{log.fieldChanged}</code>
                            </div>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalAuditLogs}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}

        {auditLogs.length === 0 && (
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs</h3>
            <p className="mt-1 text-sm text-gray-500">
              Audit logs will appear here as changes are made to the system.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
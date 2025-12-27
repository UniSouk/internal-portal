'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from './Notification';
import ElegantSelect from './ElegantSelect';
import { 
  User, 
  Package, 
  Calendar, 
  FileText, 
  X, 
  Plus, 
  Minus,
  AlertCircle,
  Users
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface ResourceAssignmentModalProps {
  resource: {
    id: string;
    name: string;
    type: string;
    totalQuantity: number;
    allocatedQuantity: number;
    availableQuantity: number;
    currentAssignments: Array<{
      id: string;
      employee: Employee;
      quantityAssigned: number;
      assignedAt: string;
    }>;
  };
  isOpen: boolean;
  onClose: () => void;
  onAssignmentChange: () => void;
}

export default function ResourceAssignmentModal({ 
  resource, 
  isOpen, 
  onClose, 
  onAssignmentChange 
}: ResourceAssignmentModalProps) {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<'assign' | 'manage'>('assign');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successState, setSuccessState] = useState<{
    show: boolean;
    message: string;
    type: 'assign' | 'return';
  }>({ show: false, message: '', type: 'assign' });

  // Assignment form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState(1);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Return form state
  const [returningAssignments, setReturningAssignments] = useState<{[key: string]: {
    quantity: number;
    reason: string;
    notes: string;
  }}>({});

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      setSelectedEmployeeId('');
      setAssignQuantity(1);
      setAssignmentNotes('');
      setReturningAssignments({});
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const response = await fetch('/api/employees?page=1&limit=1000');
      if (response.ok) {
        const data = await response.json();
        // Filter out employees who already have active assignments for this resource
        const assignedEmployeeIds = resource.currentAssignments.map(a => a.employee.id);
        const availableEmployees = (data.employees || []).filter(
          (emp: Employee) => !assignedEmployeeIds.includes(emp.id)
        );
        setEmployees(availableEmployees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      showNotification('error', 'Load Failed', 'Unable to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAssignResource = async () => {
    if (!selectedEmployeeId || assignQuantity <= 0) {
      showNotification('warning', 'Invalid Input', 'Please select an employee and specify a valid quantity');
      return;
    }

    if (assignQuantity > resource.availableQuantity) {
      showNotification('error', 'Insufficient Quantity', `Only ${resource.availableQuantity} units available`);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/resources/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: resource.id,
          employeeId: selectedEmployeeId,
          quantityAssigned: assignQuantity,
          notes: assignmentNotes
        })
      });

      if (response.ok) {
        const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
        const successMessage = `Successfully assigned ${assignQuantity} unit(s) of ${resource.name} to ${selectedEmployee?.name}`;
        
        showNotification('success', 'Assignment Created', successMessage);
        
        // Show success state
        setSuccessState({
          show: true,
          message: successMessage,
          type: 'assign'
        });
        
        // Reset form
        setSelectedEmployeeId('');
        setAssignQuantity(1);
        setAssignmentNotes('');
        
        // Refresh data and close modal after a short delay for smooth UX
        onAssignmentChange();
        
        // Close modal after successful assignment
        setTimeout(() => {
          setSuccessState({ show: false, message: '', type: 'assign' });
          onClose();
        }, 2000); // Give time for user to see the success message
        
      } else {
        const errorData = await response.json();
        showNotification('error', 'Assignment Failed', errorData.error || 'Failed to assign resource');
      }
    } catch (error) {
      console.error('Error assigning resource:', error);
      showNotification('error', 'Network Error', 'Unable to assign resource. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturnResource = async (assignmentId: string) => {
    const returnData = returningAssignments[assignmentId];
    console.log('=== FRONTEND RETURN DEBUG ===');
    console.log('Assignment ID:', assignmentId);
    console.log('Return data:', returnData);
    
    if (!returnData || returnData.quantity <= 0) {
      showNotification('warning', 'Invalid Input', 'Please specify a valid return quantity');
      return;
    }

    if (!returnData.reason) {
      showNotification('warning', 'Missing Reason', 'Please select a return reason');
      return;
    }

    setProcessing(true);
    try {
      const requestBody = {
        action: 'return',
        quantityReturned: returnData.quantity,
        returnReason: returnData.reason,
        notes: returnData.notes
      };
      
      console.log('Sending request body:', requestBody);
      
      const response = await fetch(`/api/resources/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const assignment = resource.currentAssignments.find(a => a.id === assignmentId);
        const successMessage = `Successfully returned ${returnData.quantity} unit(s) from ${assignment?.employee.name}`;
        
        showNotification('success', 'Resource Returned', successMessage);
        
        // Show success state
        setSuccessState({
          show: true,
          message: successMessage,
          type: 'return'
        });
        
        // Clear return form for this assignment
        setReturningAssignments(prev => {
          const updated = { ...prev };
          delete updated[assignmentId];
          return updated;
        });
        
        // Refresh data
        onAssignmentChange();
        
        // If this was the last assignment, close modal after a delay
        if (resource.currentAssignments.length === 1) {
          setTimeout(() => {
            setSuccessState({ show: false, message: '', type: 'return' });
            onClose();
          }, 2000);
        } else {
          // Clear success state after showing it
          setTimeout(() => {
            setSuccessState({ show: false, message: '', type: 'return' });
          }, 2000);
        }
        
      } else {
        const errorData = await response.json();
        console.log('API Error Response:', errorData);
        showNotification('error', 'Return Failed', errorData.error || 'Failed to return resource');
      }
    } catch (error) {
      console.error('Error returning resource:', error);
      showNotification('error', 'Network Error', 'Unable to return resource. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const updateReturnData = (assignmentId: string, field: string, value: any) => {
    setReturningAssignments(prev => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        quantity: prev[assignmentId]?.quantity || 1,
        reason: prev[assignmentId]?.reason || '',
        notes: prev[assignmentId]?.notes || '',
        [field]: value
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className={`relative w-full max-w-4xl bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto transition-all duration-300 ${processing && !successState.show ? 'opacity-75' : 'opacity-100'}`}>
        {/* Processing Overlay */}
        {processing && !successState.show && (
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-40 rounded-xl">
            <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-700">Processing...</span>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Manage Resource Assignments</h3>
              <p className="text-sm text-gray-600 mt-1">
                Assign or return <span className="font-medium">{resource.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Resource Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{resource.totalQuantity}</div>
              <div className="text-sm text-gray-500">Total Units</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{resource.allocatedQuantity}</div>
              <div className="text-sm text-gray-500">Allocated</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${resource.availableQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {resource.availableQuantity}
              </div>
              <div className="text-sm text-gray-500">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{resource.currentAssignments.length}</div>
              <div className="text-sm text-gray-500">Employees</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('assign')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'assign'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                Assign Resource
              </div>
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'manage'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4" />
                Manage Assignments ({resource.currentAssignments.length})
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Success State Overlay */}
          {successState.show && (
            <div className="fixed inset-0 bg-green-50 bg-opacity-95 flex items-center justify-center z-50 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4 text-center animate-success">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {successState.type === 'assign' ? 'Assignment Successful!' : 'Return Successful!'}
                </h3>
                <p className="text-gray-600 mb-4">{successState.message}</p>
                <div className="flex items-center justify-center">
                  <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full mr-2"></div>
                  <span className="text-sm text-gray-500">Updating resources...</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assign' && (
            <div className="space-y-6">
              {resource.availableQuantity === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Units Available</h3>
                  <p className="text-gray-600">
                    All {resource.totalQuantity} units of this resource are currently allocated. 
                    You need to return some units before making new assignments.
                  </p>
                </div>
              ) : (
                <>
                  {/* Employee Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-gray-600" />
                        Select Employee <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <ElegantSelect
                      options={[
                        { value: '', label: loadingEmployees ? 'Loading employees...' : 'Select an employee' },
                        ...employees.map((employee) => ({
                          value: employee.id,
                          label: employee.name,
                          description: `${employee.role.replace(/_/g, ' ')} • ${employee.department}`,
                          icon: (
                            <div className="h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )
                        }))
                      ]}
                      value={selectedEmployeeId}
                      onChange={setSelectedEmployeeId}
                      placeholder="Select an employee"
                      disabled={loadingEmployees}
                      searchable={true}
                      className="w-full"
                      size="md"
                    />
                    {employees.length === 0 && !loadingEmployees && (
                      <p className="mt-2 text-sm text-amber-600">
                        All employees already have assignments for this resource
                      </p>
                    )}
                  </div>

                  {/* Quantity Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-600" />
                        Quantity to Assign <span className="text-red-500">*</span>
                      </div>
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setAssignQuantity(Math.max(1, assignQuantity - 1))}
                        disabled={assignQuantity <= 1}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={resource.availableQuantity}
                        value={assignQuantity}
                        onChange={(e) => setAssignQuantity(Math.max(1, Math.min(resource.availableQuantity, parseInt(e.target.value) || 1)))}
                        className="w-20 text-center border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setAssignQuantity(Math.min(resource.availableQuantity, assignQuantity + 1))}
                        disabled={assignQuantity >= resource.availableQuantity}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <span className="text-sm text-gray-600">
                        of {resource.availableQuantity} available
                      </span>
                    </div>
                  </div>

                  {/* Assignment Notes */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-600" />
                        Assignment Notes (Optional)
                      </div>
                    </label>
                    <textarea
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Add any notes about this assignment..."
                    />
                  </div>

                  {/* Assign Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleAssignResource}
                      disabled={!selectedEmployeeId || assignQuantity <= 0 || processing}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        selectedEmployeeId && assignQuantity > 0 && !processing
                          ? 'bg-blue-600 text-white hover:bg-blue-700 transform hover:scale-105'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {processing ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Assigning...
                        </div>
                      ) : (
                        `Assign ${assignQuantity} Unit${assignQuantity !== 1 ? 's' : ''}`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-6">
              {resource.currentAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Assignments</h3>
                  <p className="text-gray-600">
                    This resource is not currently assigned to any employees.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resource.currentAssignments.map((assignment) => (
                    <div key={assignment.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {assignment.employee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{assignment.employee.name}</h4>
                            <p className="text-sm text-gray-600">
                              {assignment.employee.role.replace(/_/g, ' ')} • {assignment.employee.department}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">{assignment.quantityAssigned}</div>
                          <div className="text-sm text-gray-500">unit{assignment.quantityAssigned !== 1 ? 's' : ''}</div>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Assigned on {new Date(assignment.assignedAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Return Form */}
                      <div className="border-t border-gray-200 pt-4">
                        <h5 className="font-medium text-gray-900 mb-3">Return Units</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity to Return
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={assignment.quantityAssigned}
                              value={returningAssignments[assignment.id]?.quantity || 1}
                              onChange={(e) => updateReturnData(assignment.id, 'quantity', 
                                Math.max(1, Math.min(assignment.quantityAssigned, parseInt(e.target.value) || 1)))}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Return Reason
                            </label>
                            <select
                              value={returningAssignments[assignment.id]?.reason || ''}
                              onChange={(e) => updateReturnData(assignment.id, 'reason', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select reason</option>
                              <option value="No longer needed">No longer needed</option>
                              <option value="Employee left">Employee left</option>
                              <option value="Upgrade requested">Upgrade requested</option>
                              <option value="Maintenance required">Maintenance required</option>
                              <option value="Damaged">Damaged</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Notes (Optional)
                            </label>
                            <input
                              type="text"
                              value={returningAssignments[assignment.id]?.notes || ''}
                              onChange={(e) => updateReturnData(assignment.id, 'notes', e.target.value)}
                              placeholder="Additional notes..."
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={() => handleReturnResource(assignment.id)}
                            disabled={!returningAssignments[assignment.id]?.reason || processing}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                              returningAssignments[assignment.id]?.reason && !processing
                                ? 'bg-orange-600 text-white hover:bg-orange-700 transform hover:scale-105'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {processing ? (
                              <div className="flex items-center gap-2">
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </div>
                            ) : (
                              'Return Units'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
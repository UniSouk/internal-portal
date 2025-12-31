'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Eye, Link, KeyRound, Trash2 } from 'lucide-react';
import EmployeeForm from '@/components/EmployeeForm';
import EmployeeResources from '@/components/EmployeeResources';
import ProtectedRoute from '@/components/ProtectedRoute';
import Pagination from '@/components/Pagination';
import { useNotification } from '@/components/Notification';
import { Role, Status } from '@/types';

interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  status: Status;
  joiningDate: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  subordinates?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingDependencies, setViewingDependencies] = useState<string | null>(null);
  const [viewingResources, setViewingResources] = useState<{ id: string; name: string } | null>(null);
  const [dependencies, setDependencies] = useState<any>(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<{ id: string; name: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showNotification, NotificationComponent } = useNotification();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalEmployees, setTotalEmployees] = useState(0);

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, itemsPerPage]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`/api/employees?page=${currentPage}&limit=${itemsPerPage}`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || data);
        setTotalEmployees(data.total || data.length);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const totalPages = Math.ceil(totalEmployees / itemsPerPage);

  const handleCreateEmployee = async (employeeData: any) => {
    if (submitting) return; // Prevent double submissions
    
    setSubmitting(true);
    try {
      if (editingEmployee) {
        // Update existing employee
        const response = await fetch(`/api/employees?id=${editingEmployee.id}&updatedBy=system`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(employeeData),
        });

        if (response.ok) {
          const updatedEmployee = await response.json();
          setEmployees(employees.map(emp => emp.id === editingEmployee.id ? updatedEmployee : emp));
          setShowForm(false);
          setEditingEmployee(null);
          showNotification('success', 'Employee Updated', `${updatedEmployee.name} has been successfully updated.`);
        } else {
          const errorData = await response.json();
          console.error('Employee update failed:', errorData);
          
          // Show specific error message based on error type
          if (errorData.code === 'DUPLICATE_EMAIL') {
            showNotification('error', 'Email Already Exists', errorData.message || 'This email address is already registered. Please use a different email address.');
          } else if (errorData.field === 'email') {
            showNotification('error', 'Email Error', errorData.message || 'There was an issue with the email address provided.');
          } else {
            showNotification('error', 'Update Failed', errorData.message || errorData.error || 'Failed to update employee. Please try again.');
          }
        }
      } else {
        // Create new employee
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(employeeData),
        });

        if (response.ok) {
          const newEmployee = await response.json();
          setEmployees([newEmployee, ...employees]);
          setShowForm(false);
          showNotification('success', 'Employee Created', `${newEmployee.name} has been successfully created and will be redirected to resource assignment.`);
          
          // Redirect to resource assignment page for the new employee
          router.push(`/employees/${newEmployee.id}/assign-resources`);
        } else {
          const errorData = await response.json();
          console.error('Employee creation failed:', errorData);
          
          // Show specific error message based on error type
          if (errorData.code === 'DUPLICATE_EMAIL') {
            showNotification('error', 'Email Already Exists', errorData.message || 'This email address is already registered. Please use a different email address.');
          } else if (errorData.field === 'email') {
            showNotification('error', 'Email Error', errorData.message || 'There was an issue with the email address provided.');
          } else {
            showNotification('error', 'Creation Failed', errorData.message || errorData.error || 'Failed to create employee. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      showNotification('error', 'Network Error', 'Unable to save employee. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingEmployee(null);
  };

  const handleReassignOwnership = async (fromEmployeeId: string) => {
    // Get list of other employees for selection
    const availableEmployees = employees.filter(emp => emp.id !== fromEmployeeId);
    
    if (availableEmployees.length === 0) {
      showNotification('warning', 'No Employees Available', 'No other employees available for reassignment');
      return;
    }

    // Create a simple selection dialog
    const employeeOptions = availableEmployees.map(emp => `${emp.name} (${emp.email})`).join('\n');
    const selectedName = prompt(`Select employee to reassign ownership to:\n\n${employeeOptions}\n\nEnter the full name:`);
    
    if (!selectedName) return;

    const selectedEmployee = availableEmployees.find(emp => emp.name === selectedName);
    if (!selectedEmployee) {
      showNotification('error', 'Employee Not Found', 'Employee not found. Please enter the exact name.');
      return;
    }

    try {
      const response = await fetch('/api/employees/reassign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromEmployeeId,
          toEmployeeId: selectedEmployee.id,
          reassignBy: 'system'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('success', 'Ownership Reassigned', `Successfully reassigned ownership to ${result.toEmployee}: ${result.reassigned.policies} policies, ${result.reassigned.documents} documents, ${result.reassigned.resources} resources, ${result.reassigned.subordinates} subordinates`);
        // Refresh dependencies
        handleViewDependencies(fromEmployeeId);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Reassignment Failed', errorData.error || 'Failed to reassign ownership');
      }
    } catch (error) {
      console.error('Error reassigning ownership:', error);
      showNotification('error', 'Network Error', 'Unable to reassign ownership. Please try again.');
    }
  };

  const handleViewDependencies = async (id: string) => {
    try {
      const response = await fetch(`/api/employees/dependencies?id=${id}`);
      if (response.ok) {
        const data = await response.json();
        setDependencies(data);
        setViewingDependencies(id);
      } else {
        showNotification('error', 'Load Failed', 'Failed to load employee dependencies');
      }
    } catch (error) {
      console.error('Error loading dependencies:', error);
      showNotification('error', 'Network Error', 'Unable to load dependencies. Please try again.');
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      const response = await fetch(`/api/employees?id=${id}&deletedBy=system`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setEmployees(employees.filter(emp => emp.id !== id));
        setDeleteConfirm(null);
        showNotification('success', 'Employee Deleted', 'Employee has been successfully deleted.');
      } else {
        const errorData = await response.json();
        
        // Handle CEO deletion attempt
        if (response.status === 403 && errorData.error === 'Cannot delete CEO') {
          showNotification('error', 'CEO Protection', errorData.message || 'The CEO position cannot be deleted as it is critical for system operations.');
          setDeleteConfirm(null);
          return;
        }
        
        // Show detailed error message if available
        if (errorData.details) {
          const details = errorData.details;
          let detailMessage = 'This employee has associated records: ';
          const items = [];
          if (details.policies > 0) items.push(`${details.policies} policies`);
          if (details.documents > 0) items.push(`${details.documents} documents`);
          if (details.resources > 0) items.push(`${details.resources} resources`);
          if (details.accessRequests > 0) items.push(`${details.accessRequests} access requests`);
          if (details.approvals > 0) items.push(`${details.approvals} approvals`);
          if (details.workflows > 0) items.push(`${details.workflows} workflows`);
          detailMessage += items.join(', ') + '. Please reassign or remove these records first.';
          
          showNotification('error', 'Cannot Delete Employee', detailMessage);
        } else {
          showNotification('error', 'Delete Failed', errorData.error || 'Failed to delete employee');
        }
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      showNotification('error', 'Network Error', 'Unable to delete employee. Please try again.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetPasswordEmployee) return;
    
    if (newPassword !== confirmPassword) {
      showNotification('error', 'Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }
    
    if (newPassword.length < 6) {
      showNotification('error', 'Password Too Short', 'Password must be at least 6 characters long.');
      return;
    }
    
    setResetPasswordLoading(true);
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: resetPasswordEmployee.id,
          newPassword: newPassword
        }),
      });

      if (response.ok) {
        showNotification('success', 'Password Reset', `Password has been successfully reset for ${resetPasswordEmployee.name}.`);
        setResetPasswordEmployee(null);
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Reset Failed', errorData.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      showNotification('error', 'Network Error', 'Unable to reset password. Please try again.');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case Status.ACTIVE:
        return 'bg-green-100 text-green-800';
      case Status.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case Status.RESIGNED:
        return 'bg-red-100 text-red-800';
      case Status.ON_LEAVE:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: Role) => {
    // Handle the new role types
    if (role.toString().includes('MANAGER')) {
      return 'bg-indigo-100 text-indigo-800';
    }
    if (role.toString().includes('DEVELOPER')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (role.toString().includes('CEO') || role.toString().includes('CTO') || role.toString().includes('CFO')) {
      return 'bg-purple-100 text-purple-800';
    }
    
    switch (role) {
      case Role.ADMIN:
        return 'bg-purple-100 text-purple-800';
      case Role.EMPLOYEE:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading employees...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['CEO', 'CTO']}>
      {NotificationComponent}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Employee Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage employee records, roles, and organizational hierarchy.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Add Employee
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden bg-white shadow-sm rounded-lg">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Manager
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joining Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {employees.map((employee, index) => (
                    <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {employee.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                              </svg>
                              {employee.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${getRoleColor(employee.role)}`}>
                          <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0h8" />
                          </svg>
                          {employee.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {employee.department}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.manager ? (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {employee.manager.name}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(employee.status)}`}>
                          {employee.status === 'ACTIVE' && (
                            <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          {employee.status === 'INACTIVE' && (
                            <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.phone ? (
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {employee.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(employee.joiningDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          {/* Edit Employee */}
                          <div className="relative group">
                            <button 
                              onClick={() => handleEditEmployee(employee)}
                              className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              Edit Employee
                            </div>
                          </div>

                          {/* View Resources */}
                          {/* <div className="relative group">
                            <button 
                              onClick={() => setViewingResources({ id: employee.id, name: employee.name })}
                              className="inline-flex items-center justify-center w-8 h-8 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-full transition-colors"
                            >
                              <Eye size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              View Resources
                            </div>
                          </div> */}

                          {/* View Dependencies */}
                          <div className="relative group">
                            <button 
                              onClick={() => handleViewDependencies(employee.id)}
                              className="inline-flex items-center justify-center w-8 h-8 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-full transition-colors"
                            >
                              <Link size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              View Dependencies
                            </div>
                          </div>

                          {/* Reset Password */}
                          <div className="relative group">
                            <button 
                              onClick={() => setResetPasswordEmployee({ id: employee.id, name: employee.name, email: employee.email })}
                              className="inline-flex items-center justify-center w-8 h-8 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-full transition-colors"
                            >
                              <KeyRound size={16} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              Reset Password
                            </div>
                          </div>

                          {/* Delete Employee - Hidden for CEO */}
                          {employee.role !== 'CEO' && (
                            <div className="relative group">
                              <button 
                                onClick={() => setDeleteConfirm(employee.id)}
                                className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Delete Employee
                              </div>
                            </div>
                          )}
                          
                          {/* CEO Protection Message */}
                          {employee.role === 'CEO' && (
                            <div className="relative group">
                              <div className="inline-flex items-center justify-center w-8 h-8 text-gray-400 cursor-not-allowed rounded-full">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                CEO cannot be deleted
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalEmployees}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        </div>
      </div>

      {employees.length === 0 && (
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No employees</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a new employee.</p>
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
              <h3 className="text-lg font-medium text-gray-900 mt-2">Delete Employee</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this employee? This action cannot be undone.
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
                  onClick={() => handleDeleteEmployee(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependencies Modal */}
      {viewingDependencies && dependencies && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Employee Dependencies</h3>
                <div className="flex space-x-2">
                  {(dependencies.policies || dependencies.documents || dependencies.resources || dependencies.subordinates) && (
                    <button
                      onClick={() => handleReassignOwnership(viewingDependencies)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      title="Reassigns ownership of policies, documents, resources (custodianship), and subordinates. Does not reassign resource assignments."
                    >
                      Reassign Ownership
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setViewingDependencies(null);
                      setDependencies(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {dependencies.policies?.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Policies ({dependencies.policies.length})</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      {dependencies.policies.map((policy: any) => (
                        <li key={policy.id}>• {policy.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {dependencies.documents?.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Documents ({dependencies.documents.length})</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      {dependencies.documents.map((doc: any) => (
                        <li key={doc.id}>• {doc.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {dependencies.resources?.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">Managed Resources ({dependencies.resources.length})</h4>
                    <p className="text-xs text-yellow-700 mb-2">Resources where this employee is the custodian</p>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {dependencies.resources.map((resource: any) => (
                        <li key={resource.id}>• {resource.name} ({resource.type})</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {dependencies.assignedResources?.length > 0 && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">Assigned Resources ({dependencies.assignedResources.length})</h4>
                    <p className="text-xs text-purple-700 mb-2">Resources allocated to this employee</p>
                    <div className="bg-purple-100 border border-purple-200 rounded p-2 mb-2">
                      <p className="text-xs text-purple-800">
                        <strong>Note:</strong> These resources are assigned to the employee and should be returned before deletion. 
                        Use the "Return" option in the Resources section to unallocate them.
                      </p>
                    </div>
                    <ul className="text-sm text-purple-800 space-y-1">
                      {dependencies.assignedResources.map((assignment: any) => (
                        <li key={assignment.id} className="flex flex-col">
                          <span>• {assignment.resource.name} ({assignment.resource.type})</span>
                          {assignment.item?.serialNumber && (
                            <span className="text-xs text-purple-600 ml-2">Serial: {assignment.item.serialNumber}</span>
                          )}
                          {assignment.item?.hostname && (
                            <span className="text-xs text-purple-600 ml-2">Hostname: {assignment.item.hostname}</span>
                          )}
                          {assignment.item?.licenseKey && (
                            <span className="text-xs text-purple-600 ml-2">License: {assignment.item.licenseKey}</span>
                          )}
                          <span className="text-xs text-purple-600 ml-2">
                            Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {dependencies.subordinates?.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-medium text-red-900 mb-2">Subordinates ({dependencies.subordinates.length})</h4>
                    <ul className="text-sm text-red-800 space-y-1">
                      {dependencies.subordinates.map((sub: any) => (
                        <li key={sub.id}>• {sub.name} ({sub.email})</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {dependencies.accessRequests?.length > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h4 className="font-medium text-indigo-900 mb-2">Access Requests ({dependencies.accessRequests.length})</h4>
                    <ul className="text-sm text-indigo-800 space-y-1">
                      {dependencies.accessRequests.map((access: any) => (
                        <li key={access.id}>• {access.resource?.name} ({access.status})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {Object.keys(dependencies).filter(key => key !== 'employee').every(key => !dependencies[key]?.length) && (
                <div className="text-center py-8">
                  <div className="text-green-600 mb-2">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No Dependencies</h3>
                  <p className="text-gray-500">This employee can be safely deleted.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <EmployeeForm
          onSubmit={handleCreateEmployee}
          onCancel={handleCancelForm}
          employees={employees}
          editingEmployee={editingEmployee}
          isEditing={!!editingEmployee}
          submitting={submitting}
        />
      )}

      {viewingResources && (
        <EmployeeResources
          employeeId={viewingResources.id}
          employeeName={viewingResources.name}
          isOpen={!!viewingResources}
          onClose={() => setViewingResources(null)}
        />
      )}

      {/* Password Reset Modal */}
      {resetPasswordEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
                <button
                  onClick={() => {
                    setResetPasswordEmployee(null);
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-800">
                        <strong>Employee:</strong> {resetPasswordEmployee.name}<br />
                        <strong>Email:</strong> {resetPasswordEmployee.email}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleResetPassword}>
                <div className="mb-4">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer hover:bg-gray-100 rounded-r-md transition-colors duration-200"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Password must be at least 6 characters long.
                  </p>
                </div>

                <div className="mb-4">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer hover:bg-gray-100 rounded-r-md transition-colors duration-200"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-600">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This will immediately change the employee's password. 
                        They will need to use the new password to log in.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResetPasswordEmployee(null);
                      setNewPassword('');
                      setConfirmPassword('');
                      setShowNewPassword(false);
                      setShowConfirmPassword(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetPasswordLoading || newPassword !== confirmPassword || newPassword.length < 6}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  );
}
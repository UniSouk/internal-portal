'use client';

import { useState } from 'react';
import { Role } from '@/types';
import ElegantSelect from '@/components/ElegantSelect';

interface EmployeeFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  employees: Array<{ id: string; name: string; email: string; department: string }>;
  editingEmployee?: any;
  isEditing?: boolean;
  submitting?: boolean;
}

export default function EmployeeForm({ onSubmit, onCancel, employees, editingEmployee, isEditing = false, submitting = false }: EmployeeFormProps) {
  const [formData, setFormData] = useState({
    name: editingEmployee?.name || '',
    email: editingEmployee?.email || '',
    role: editingEmployee?.role || Role.EMPLOYEE,
    department: editingEmployee?.department || '',
    managerId: editingEmployee?.managerId || '',
    joiningDate: editingEmployee?.joiningDate ? new Date(editingEmployee.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    phone: editingEmployee?.phone || ''
  });

  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    // Check if email is already taken by another employee
    const existingEmployee = employees.find(emp => 
      emp.email.toLowerCase() === email.toLowerCase() && 
      emp.id !== editingEmployee?.id
    );
    
    if (existingEmployee) {
      setEmailError('This email address is already registered to another employee');
      return false;
    }
    
    setEmailError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email before submission
    if (!validateEmail(formData.email)) {
      return;
    }
    
    onSubmit({
      ...formData,
      id: editingEmployee?.id,
      managerId: formData.managerId || null,
      joiningDate: new Date(formData.joiningDate)
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Validate email on change
    if (name === 'email') {
      validateEmail(value);
    }
  };

  // Filter potential managers (exclude current employee)
  const potentialManagers = employees.filter(emp => 
    emp.id !== editingEmployee?.id // Don't allow self as manager
  );

  // Group roles by category for better UX
  const roleCategories = {
    'Executive': [Role.CEO, Role.CTO],
    'Management': [Role.ENGINEERING_MANAGER, Role.PRODUCT_MANAGER, Role.SALES_MANAGER, Role.HR_MANAGER],
    'Development': [Role.FRONTEND_DEVELOPER, Role.BACKEND_DEVELOPER, Role.FULLSTACK_DEVELOPER, Role.DEVOPS_ENGINEER, Role.QA_ENGINEER],
    'Technical': [Role.UI_UX_DESIGNER, Role.SYSTEM_ADMINISTRATOR, Role.SECURITY_ENGINEER],
    'Business': [Role.SALES_REPRESENTATIVE, Role.BUSINESS_ANALYST, Role.MARKETING_SPECIALIST, Role.ACCOUNTANT],
    'Entry Level': [Role.INTERN, Role.JUNIOR_DEVELOPER, Role.TRAINEE],
    'General': [Role.ADMIN, Role.EMPLOYEE]
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {isEditing ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      emailError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {emailError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input
                    type="number"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Joining Date *</label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Job Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-3">Job Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role *</label>
                  <ElegantSelect
                    options={Object.entries(roleCategories).flatMap(([category, roles]) => [
                      { value: `category-${category}`, label: category, disabled: true },
                      ...roles.map(role => ({
                        value: role,
                        label: role.replace(/_/g, ' '),
                        description: category
                      }))
                    ])}
                    value={formData.role}
                    onChange={(value) => setFormData({ ...formData, role: value })}
                    placeholder="Select a role"
                    searchable={true}
                    className="w-full"
                    size="md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Department *</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Engineering, Sales, Marketing, HR"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Manager</label>
                  <ElegantSelect
                    options={[
                      { value: '', label: 'No Manager' },
                      ...potentialManagers.map(manager => ({
                        value: manager.id,
                        label: `${manager.name} (${manager.department})`,
                        icon: (
                          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {manager.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ),
                        description: manager.department
                      }))
                    ]}
                    value={formData.managerId}
                    onChange={(value) => setFormData({ ...formData, managerId: value })}
                    placeholder="Select a manager"
                    searchable={true}
                    showClearButton={true}
                    className="w-full"
                    size="md"
                  />
                </div>
              </div>

              {/* Information Notice for New Employees */}
              {!isEditing && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">Account Activation Required</h4>
                      <p className="mt-1 text-sm text-blue-700">
                        New employees will be created with <strong>INACTIVE</strong> status. They must visit the signup page to activate their account and set a password before they can access the system.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !!emailError}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </div>
                ) : (
                  isEditing ? 'Update Employee' : 'Create Employee'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
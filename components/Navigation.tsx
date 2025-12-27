'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { getUserPermissions } from '@/lib/permissions';

export default function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

    // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Don't show navigation on auth pages
  if (pathname === '/login' || pathname === '/signup') {
    return null;
  }

  // Don't show navigation if user is not authenticated
  if (!user) {
    return null;
  }

  const permissions = getUserPermissions(user.role as any);


  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const isActivePath = (path: string) => {
    return pathname === path;
  };

  const navLinkClass = (path: string) => {
    const baseClass = "whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm transition-colors duration-200";
    if (isActivePath(path)) {
      return `${baseClass} border-blue-500 text-blue-600`;
    }
    return `${baseClass} border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`;
  };

  const mobileNavLinkClass = (path: string) => {
    const baseClass = "block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200";
    if (isActivePath(path)) {
      return `${baseClass} bg-blue-50 border-blue-500 text-blue-700`;
    }
    return `${baseClass} border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300`;
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Desktop Navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                Internal Portal
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-8 md:flex md:items-center md:space-x-6">
              {permissions.canViewAllEmployees && (
                <Link href="/employees" className={navLinkClass('/employees')}>
                  Employees
                </Link>
              )}
              
              <Link href="/resources" className={navLinkClass('/resources')}>
                Resources
              </Link>
              
              {!permissions.canViewAllEmployees && (
                <Link href="/access" className={navLinkClass('/access')}>
                  Access
                </Link>
              )}
              
              {permissions.canApproveWorkflows && (
                <Link href="/policies" className={navLinkClass('/policies')}>
                  Policies
                </Link>
              )}
              
              {permissions.canApproveWorkflows && (
                <Link href="/approvals" className={navLinkClass('/approvals')}>
                  Approvals
                </Link>
              )}
              
              {permissions.canViewAudit && (
                <Link href="/audit" className={navLinkClass('/audit')}>
                  Audit
                </Link>
              )}
              
              {permissions.canViewTimeline && (
                <Link href="/timeline" className={navLinkClass('/timeline')}>
                  Timeline
                </Link>
              )}
            </div>
          </div>

          {/* Right side - User menu and mobile menu button */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
            >
              <span className="sr-only">Open main menu</span>
              {showMobileMenu ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center space-x-3 py-1 px-2 rounded-full hover:bg-gray-50">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                      <span className="text-sm font-medium text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-left min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user.role.replace(/_/g, ' ')}</div>
                  </div>
                  <svg className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* User dropdown menu */}
              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 animate-in slide-in-from-top-2 duration-200">
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400 mt-1">{user.role.replace(/_/g, ' ')} • {user.department}</div>
                    </div>
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="mr-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-gray-200 bg-white animate-in slide-in-from-top-2 duration-200">
          <div className="pt-2 pb-3 space-y-1">
            {permissions.canViewAllEmployees && (
              <Link
                href="/employees"
                className={mobileNavLinkClass('/employees')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  Employees
                </div>
              </Link>
            )}
            
            <Link
              href="/resources"
              className={mobileNavLinkClass('/resources')}
              onClick={() => setShowMobileMenu(false)}
            >
              <div className="flex items-center">
                <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Resources
              </div>
            </Link>
            
            {!permissions.canViewAllEmployees && (
              <Link
                href="/access"
                className={mobileNavLinkClass('/access')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                  </svg>
                  Access
                </div>
              </Link>
            )}
            
            {permissions.canApproveWorkflows && (
              <Link
                href="/policies"
                className={mobileNavLinkClass('/policies')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Policies
                </div>
              </Link>
            )}
            
            {permissions.canApproveWorkflows && (
              <Link
                href="/approvals"
                className={mobileNavLinkClass('/approvals')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Approvals
                </div>
              </Link>
            )}
            
            {permissions.canViewAudit && (
              <Link
                href="/audit"
                className={mobileNavLinkClass('/audit')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Audit
                </div>
              </Link>
            )}
            
            {permissions.canViewTimeline && (
              <Link
                href="/timeline"
                className={mobileNavLinkClass('/timeline')}
                onClick={() => setShowMobileMenu(false)}
              >
                <div className="flex items-center">
                  <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Timeline
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
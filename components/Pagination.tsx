'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import ElegantSelect from './ElegantSelect';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = (isMobile: boolean = false) => {
    if (isMobile) {
      // On mobile, show fewer pages
      const delta = 1;
      const range = [];
      const rangeWithDots = [];

      for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, '...');
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push('...', totalPages);
      } else if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots;
    } else {
      // Desktop version with more pages
      const delta = 2;
      const range = [];
      const rangeWithDots = [];

      for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, '...');
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push('...', totalPages);
      } else if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots;
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Mobile Layout */}
      <div className="block sm:hidden">
        {/* Mobile Stats */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{startItem}-{endItem}</span> of{' '}
              <span className="font-medium">{totalItems}</span>
            </p>
            <div className="flex items-center space-x-2 relative z-20">
              <ElegantSelect
                options={[
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' }
                ]}
                value={itemsPerPage.toString()}
                onChange={(value) => onItemsPerPageChange(Number(value))}
                className="w-16 relative z-10"
                size="sm"
              />
              <span className="text-xs text-gray-500">per page</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            {/* Mobile Page Numbers */}
            <div className="flex items-center space-x-1">
              {getVisiblePages(true).map((page, index) => (
                <span key={`mobile-page-${page}-${index}`}>
                  {page === '...' ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 text-sm text-gray-500">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  ) : (
                    <button
                      onClick={() => onPageChange(page as number)}
                      className={`inline-flex items-center justify-center w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )}
                </span>
              ))}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:block">
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Stats and Items Per Page */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span> of{' '}
                <span className="font-medium">{totalItems}</span> results
              </p>
              
              <div className="flex items-center space-x-2 relative z-20">
                <label htmlFor="itemsPerPage" className="text-sm text-gray-700 whitespace-nowrap">
                  Show:
                </label>
                <ElegantSelect
                  options={[
                    { value: '10', label: '10' },
                    { value: '25', label: '25' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' }
                  ]}
                  value={itemsPerPage.toString()}
                  onChange={(value) => onItemsPerPageChange(Number(value))}
                  className="md:w-52 relative z-10"
                  size="sm"
                />
                <span className="text-sm text-gray-700 whitespace-nowrap">per page</span>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="flex items-center space-x-1" aria-label="Pagination">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center w-10 h-10 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {getVisiblePages().map((page, index) => (
                <span key={`desktop-page-${page}-${index}`}>
                  {page === '...' ? (
                    <span className="inline-flex items-center justify-center w-10 h-10 text-sm text-gray-500">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  ) : (
                    <button
                      onClick={() => onPageChange(page as number)}
                      className={`inline-flex items-center justify-center w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                      title={`Go to page ${page}`}
                    >
                      {page}
                    </button>
                  )}
                </span>
              ))}
              
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center w-10 h-10 text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
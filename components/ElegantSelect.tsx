'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface ElegantSelectProps {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showClearButton?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  error?: boolean;
  helperText?: string;
}

export default function ElegantSelect({
  options,
  value = "",
  onChange,
  placeholder = "Select an option...",
  className = "",
  disabled = false,
  size = 'md',
  showClearButton = true,
  searchable = false,
  multiple = false,
  error = false,
  helperText
}: ElegantSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>(
    multiple ? (Array.isArray(value) ? value : value ? [value] : []) : []
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (multiple) {
      setSelectedValues(Array.isArray(value) ? value : value ? [value] : []);
    }
  }, [value, multiple]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(option => option.value === value);
  const selectedOptions = multiple ? options.filter(option => selectedValues.includes(option.value)) : [];

  const handleOptionClick = (optionValue: string) => {
    if (multiple) {
      const newSelectedValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      
      setSelectedValues(newSelectedValues);
      if (onChange) {
        onChange(newSelectedValues.join(','));
      }
    } else {
      if (onChange) {
        onChange(optionValue);
      }
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      setSelectedValues([]);
      if (onChange) {
        onChange('');
      }
    } else {
      if (onChange) {
        onChange('');
      }
    }
  };

  const handleRemoveTag = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedValues = selectedValues.filter(v => v !== valueToRemove);
    setSelectedValues(newSelectedValues);
    if (onChange) {
      onChange(newSelectedValues.join(','));
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const getDisplayValue = () => {
    if (multiple && selectedOptions.length > 0) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.slice(0, 2).map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
            >
              {option.icon && <span className="mr-1">{option.icon}</span>}
              {option.label}
              <span
                onClick={(e) => handleRemoveTag(option.value, e)}
                className="ml-1 hover:text-blue-600 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
          {selectedOptions.length > 2 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
              +{selectedOptions.length - 2} more
            </span>
          )}
        </div>
      );
    }

    if (selectedOption) {
      return (
        <div className="flex items-center">
          {selectedOption.icon && <span className="mr-2">{selectedOption.icon}</span>}
          <span>{selectedOption.label}</span>
        </div>
      );
    }

    return <span className="text-gray-400">{placeholder}</span>;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Select Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full ${sizeClasses[size]} px-3 pr-2
          bg-white border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          hover:border-gray-400
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
          transition-all duration-200
          text-left flex items-center justify-between
          ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          ${isOpen ? 'shadow-md border-blue-300' : 'shadow-sm'}
        `}
      >
        <div className="flex-1 min-w-0">
          {getDisplayValue()}
        </div>
        
        <div className="flex items-center space-x-1">
          {showClearButton && (value || selectedValues.length > 0) && !disabled && (
            <span
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
            >
              <X className={iconSizes[size]} />
            </span>
          )}
          <ChevronDown 
            className={`${iconSizes[size]} text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-60 overflow-hidden">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search options..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = multiple 
                  ? selectedValues.includes(option.value)
                  : value === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && handleOptionClick(option.value)}
                    disabled={option.disabled}
                    className={`
                      w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50
                      transition-colors duration-150 flex items-center justify-between
                      ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}
                      ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {option.icon && (
                        <span className="mr-2 flex-shrink-0">{option.icon}</span>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-500 truncate">{option.description}</div>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Helper Text */}
      {helperText && (
        <p className={`mt-1 text-xs ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
}
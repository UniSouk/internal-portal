'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface ElegantSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showClearButton?: boolean;
  autoFocus?: boolean;
  debounceMs?: number;
}

export default function ElegantSearch({
  placeholder = "Search...",
  value = "",
  onChange,
  onSearch,
  className = "",
  disabled = false,
  size = 'md',
  showClearButton = true,
  autoFocus = false,
  debounceMs = 300
}: ElegantSearchProps) {
  const [searchValue, setSearchValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }

    // Debounced search
    if (onSearch && debounceMs > 0) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearch(newValue);
      }, debounceMs);
    } else if (onSearch) {
      onSearch(newValue);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    if (onChange) {
      onChange('');
    }
    if (onSearch) {
      onSearch('');
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchValue);
    }
    if (e.key === 'Escape') {
      handleClear();
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

  const paddingClasses = {
    sm: 'pl-8 pr-8',
    md: 'pl-10 pr-10',
    lg: 'pl-12 pr-12'
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Search Icon */}
        <div className={`absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none`}>
          <Search 
            className={`${iconSizes[size]} ${
              isFocused ? 'text-blue-500' : 'text-gray-400'
            } transition-colors duration-200`} 
          />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full ${sizeClasses[size]} ${paddingClasses[size]}
            bg-white border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            hover:border-gray-400
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            transition-all duration-200
            placeholder-gray-400
            ${isFocused ? 'shadow-md border-blue-300' : 'shadow-sm'}
          `}
        />

        {/* Clear Button */}
        {showClearButton && searchValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={`
              absolute right-3 top-1/2 transform -translate-y-1/2
              text-gray-400 hover:text-gray-600
              transition-colors duration-200
              focus:outline-none focus:text-gray-600
            `}
          >
            <X className={iconSizes[size]} />
          </button>
        )}
      </div>

      {/* Search suggestions or results can be added here */}
      {isFocused && searchValue && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {/* This can be extended for search suggestions */}
          <div className="p-2 text-xs text-gray-500 text-center">
            Press Enter to search for "{searchValue}"
          </div>
        </div>
      )}
    </div>
  );
}
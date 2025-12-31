'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ResourcesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new resource catalog page
    router.replace('/resources/catalog');
  }, [router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <div className="text-lg text-gray-600">Redirecting to Resource Catalog...</div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
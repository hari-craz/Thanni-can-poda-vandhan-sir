'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { initializeApiClient } from '@/lib/api';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize API client
    initializeApiClient();

    // Check if user has token on mount
    const token = localStorage.getItem('auth_token');

    // Allow access to login page without authentication
    if (pathname === '/login') {
      setIsInitialized(true);
      return;
    }

    // Redirect to login if not authenticated
    if (!token && !isAuthenticated) {
      router.push('/login');
      return;
    }

    setIsInitialized(true);
  }, [pathname, isAuthenticated, router]);

  // Show loading state while initializing
  if (!isInitialized && pathname !== '/login') {
    return (
      <html lang="en">
        <head>
          <title>Hydronix - Water Quality Monitor</title>
        </head>
        <body className="bg-gray-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              <p className="mt-4 text-gray-600">Initializing...</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Hydronix - Water Quality Monitor</title>
        <meta name="description" content="Water quality monitoring system" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
